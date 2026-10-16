/** One durable worker on the existing Agent37 box. Never runs the archived pipeline. */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { spawn } from "node:child_process";
import {
  mkdir,
  writeFile,
  readFile,
  stat,
  statfs,
  chown,
  chmod,
  readdir,
} from "node:fs/promises";
import { createWriteStream, constants } from "node:fs";
import { MAX_EVIDENCE_ARCHIVE_BYTES } from "../convex/evidenceArchive";
import { readReport } from "./research-files";
import {
  researchInstructionsVersion,
  researchPrompt,
} from "./research-instructions";
import { readEvents } from "./agent37-gateway";
import { runtimeIdentity, previousRuntimeEnded } from "./worker-runtime";
import { createHash, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  researchReportSchema,
  validateResearchMarket,
} from "./research-report";
const config = JSON.parse(
  await readFile(
    process.env.RESEARCH_CONFIG || "/root/signals-worker/config.json",
    "utf8",
  ),
);
const client = new ConvexHttpClient(config.convexUrl);
const secret: string = config.workerSecret;
const owner = randomUUID();
const root = resolve(config.workDir || "/var/lib/signals-research/jobs");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let stopping = false;
let stopChild: (() => void) | null = null;
process.on("SIGTERM", () => {
  stopping = true;
  stopChild?.();
});
process.on("SIGINT", () => {
  stopping = true;
  stopChild?.();
});
const auth = { secret, owner };
async function lease() {
  if (!(await client.mutation(api.research.acquire, auth)))
    throw Error("Another research worker owns the lease");
}
await mkdir(root, { recursive: true, mode: 0o755 });
const gateway = `https://${config.instanceId}.agent37.app`;
const headers = {
  "X-Agent37-Key": config.agent37Key,
  "Content-Type": "application/json",
};
const ledgerFile = "/root/signals-worker/active.json";
const runtimeId = await runtimeIdentity();
let reconciledOwner: string | undefined;
try {
  const priorOwner = JSON.parse(
    await readFile("/root/signals-worker/owner.json", "utf8"),
  );
  if (typeof priorOwner.owner === "string") reconciledOwner = priorOwner.owner;
} catch (e: any) {
  if (e.code !== "ENOENT") throw e;
}
// An interrupted dispatch must be reconciled, not blindly repeated.
let previous: any = null;
try {
  previous = JSON.parse(await readFile(ledgerFile, "utf8"));
} catch (e: any) {
  if (e.code !== "ENOENT") throw e;
  if (reconciledOwner)
    throw Error("Previous worker ledger is missing; inspect before resuming");
}
// An unacknowledged dispatch could still be in transit across a reboot. Only a
// response ID proves it was created in the previous container before it stopped.
if (
  previous &&
  (!previous.responseId || !previousRuntimeEnded(previous.runtimeId, runtimeId))
) {
  if (!previous.responseId)
    throw Error(
      "Uncertain Agent37 dispatch. Inspect the instance sessions before restarting.",
    );
  const deadline = Date.now() + 60000;
  let terminal = false;
  do {
    const r = await fetch(
      `${gateway}/v1/responses/${previous.responseId}/cancel`,
      { method: "POST", headers, signal: AbortSignal.timeout(15000) },
    );
    if (!r.ok)
      throw Error("Cannot reconcile previous response; worker remains stopped");
    const b: any = await r.json();
    terminal = ["completed", "cancelled", "failed"].includes(b.status);
    if (!terminal) await sleep(2000);
  } while (!terminal && Date.now() < deadline && !stopping);
  if (!terminal)
    throw Error(
      "Previous response did not stop; manual reconciliation required",
    );
  await writeFile(ledgerFile, "null", { mode: 0o600 });
}
await writeFile(ledgerFile, "null", { mode: 0o600 });
// A reboot may finish before the old 30-second lease expires. Wait rather than
// exiting or stealing it; no research can be claimed until ownership is confirmed.
const leaseDeadline = Date.now() + 60000;
while (
  !(await client.mutation(api.research.acquire, { ...auth, reconciledOwner }))
) {
  if (Date.now() >= leaseDeadline || stopping)
    throw Error("Worker lease unavailable at startup");
  await sleep(2000);
}
await writeFile("/root/signals-worker/owner.json", JSON.stringify({ owner }), {
  mode: 0o600,
});
await writeFile(
  "/root/signals-worker/ready.json",
  JSON.stringify({
    owner,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    researchInstructionsVersion,
  }),
  { mode: 0o600 },
);
let renewing = false;
const leaseTimer = setInterval(async () => {
  if (renewing) return;
  renewing = true;
  try {
    await lease();
  } catch {
    stopping = true;
    stopChild?.();
  } finally {
    renewing = false;
  }
}, 5000);
console.log(
  JSON.stringify({
    event: "worker-started",
    owner,
    at: new Date().toISOString(),
  }),
);
// No job is claimed twice; every successful phase is a checkpoint, even across pause/restart.
while (!stopping) {
  try {
    await lease();
    const job = await client.mutation(api.research.claim, auth);
    if (!job) {
      await sleep(4000);
      continue;
    }
    let dir = join(root, job.id, job.execution);
    await mkdir(dir, { recursive: true, mode: 0o755 });
    await chown(dir, 1000, 1000);
    let settled = false;
    try {
      const fs = await statfs(root);
      if (fs.bavail * fs.bsize < 1_000_000_000)
        throw Error("Less than 1 GB free; source downloads stopped");
      const input = {
        instructionsVersion: researchInstructionsVersion,
        phase: job.phase,
        opportunity: job.opportunity,
        notes: job.notes,
        previousSteps: job.steps.map((s) => ({
          name: s.name,
          report: JSON.parse(s.report),
        })),
      };
      const reportSchema = researchReportSchema(
        job.phase,
        researchInstructionsVersion,
      );
      let replay = false;
      // A supervisor-owned receipt proves the previous model call ended normally.
      // Reuse its complete report only when the exact research input still matches.
      for (const receipt of await readdir(join(root, job.id))) {
        if (!receipt.endsWith(".completed")) continue;
        if (
          job.uploadRecovery &&
          receipt !== `${job.uploadRecovery.originalExecution}.completed`
        )
          continue;
        const prior = join(root, job.id, receipt.slice(0, -10));
        try {
          if (
            JSON.stringify(await readReport(join(prior, "input.json"))) !==
            JSON.stringify(input)
          )
            continue;
          const retained = reportSchema.parse(
            await readReport(join(prior, "report.json")),
          );
          if (
            job.uploadRecovery &&
            createHash("sha256")
              .update(JSON.stringify(retained))
              .digest("hex") !== job.uploadRecovery.reportHash
          )
            continue;
          dir = prior;
          replay = true;
          break;
        } catch {
          /* Invalid attempts remain retained; only valid reports can replay. */
        }
      }
      if (!replay && job.uploadRecovery)
        throw Error(
          "Saved upload recovery does not match current input/report; research was not rerun",
        );
      if (!replay) {
        await writeFile(
          join(dir, "input.json"),
          JSON.stringify(input, null, 2),
        );
        await writeFile(
          join(dir, "schema.json"),
          JSON.stringify(z.toJSONSchema(reportSchema)),
        );
        const prompt = researchPrompt(job.phase);
        await writeFile(join(dir, "prompt.txt"), prompt);
        let interrupted = false,
          responseId: string | null = null,
          terminal = false,
          output = "";
        let cancelInFlight = false;
        const stop = () => {
          interrupted = true;
        };
        stopChild = stop;
        const started = Date.now();
        let controlling = false;
        const poll = setInterval(async () => {
          if (controlling) return;
          controlling = true;
          try {
            const c = await client.query(api.research.control, {
              ...auth,
              id: job.id,
              execution: job.execution,
            });
            if (c.stop || stopping || Date.now() - started > 10 * 60 * 1000)
              stop();
            if (interrupted && responseId && !cancelInFlight) {
              cancelInFlight = true;
              try {
                await fetch(`${gateway}/v1/responses/${responseId}/cancel`, {
                  method: "POST",
                  headers,
                  signal: AbortSignal.timeout(10000),
                });
              } finally {
                cancelInFlight = false;
              }
            }
          } catch {
            stop();
          } finally {
            controlling = false;
          }
        }, 2000);
        await writeFile(
          ledgerFile,
          JSON.stringify({
            jobId: job.id,
            execution: job.execution,
            responseId: null,
            runtimeId,
          }),
          { mode: 0o600 },
        );
        try {
          let response = await fetch(`${gateway}/v1/responses`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              input: `Work ONLY in ${dir}. ${prompt}\nRead schema.json and write your final JSON to report.json in that directory. Also return that JSON as your final answer, without markdown fences.`,
              agent: "codex",
              reasoning_effort: "medium",
              stream: true,
              metadata: { jobId: job.id, execution: job.execution },
            }),
            signal: AbortSignal.timeout(12 * 60 * 1000),
          });
          for (let reconnect = 0; reconnect < 4 && !terminal; reconnect++) {
            if (!response.ok || !response.body)
              throw Error(`Agent37 response HTTP ${response.status}`);
            try {
              await readEvents(response.body, async (name, data) => {
                if (name === "response.created") {
                  if (
                    typeof data.id !== "string" ||
                    !/^[a-zA-Z0-9-]+$/.test(data.id)
                  )
                    throw Error("Invalid response identity");
                  responseId = data.id;
                  await writeFile(
                    ledgerFile,
                    JSON.stringify({
                      jobId: job.id,
                      execution: job.execution,
                      responseId,
                      runtimeId,
                    }),
                    { mode: 0o600 },
                  );
                  await writeFile(
                    join(dir, "response.json"),
                    JSON.stringify({ responseId, sessionId: data.session_id }),
                  );
                }
                if (name === "response.completed") {
                  terminal = true;
                  output =
                    typeof data.output_text === "string"
                      ? data.output_text
                      : "";
                }
                if (name === "response.failed") {
                  terminal = true;
                  output = "";
                }
              });
            } catch (e) {
              if (!responseId) throw e;
            }
            if (!terminal) {
              if (!responseId)
                throw Error("Agent37 disconnected before response identity");
              response = await fetch(
                `${gateway}/v1/responses/${responseId}/stream`,
                { headers, signal: AbortSignal.timeout(2 * 60 * 1000) },
              );
            }
          }
          if (!terminal)
            throw Error(
              "Agent37 response has not settled; retained identity requires reconciliation",
            );
          await writeFile(ledgerFile, "null", { mode: 0o600 });
        } finally {
          clearInterval(poll);
          stopChild = null;
        }
        if (interrupted)
          throw Error("Research stopped; completed steps preserved.");
        if (!output)
          throw Error(
            "Agent37 research failed; response identity retained for diagnosis.",
          );
        await writeFile(join(dir, "response-output.txt"), output, {
          flag:
            constants.O_WRONLY |
            constants.O_CREAT |
            constants.O_TRUNC |
            constants.O_NOFOLLOW,
        });
        await writeFile(
          join(root, job.id, `${job.execution}.completed`),
          "completed",
          { mode: 0o600 },
        );
      }
      const report = reportSchema.parse(
        await readReport(join(dir, "report.json")),
      );
      validateResearchMarket(report, job.phase, researchInstructionsVersion);
      const ids = new Set(report.sources.map((s) => s.id));
      if (
        report.claims.some(
          (c) =>
            c.sourceIds.some((id) => !ids.has(id)) ||
            (c.kind === "reported" && !c.sourceIds.length),
        )
      )
        throw Error("Report has missing source references");
      // Evidence is retained, not automatically approved. Missing artifacts are explicit gaps.
      for (const s of report.sources) {
        if (!s.artifactPath) {
          report.gaps.push(`Original source not retained: ${s.url}`);
          continue;
        }
        const p = resolve(dir, s.artifactPath);
        if (!p.startsWith(dir + "/"))
          throw Error("Source path escapes research directory");
        try {
          await stat(p);
        } catch {
          report.gaps.push(`Source artifact missing: ${s.url}`);
        }
      }
      await writeFile(
        join(dir, "checked-structure.json"),
        JSON.stringify(report, null, 2),
        {
          flag:
            constants.O_WRONLY |
            constants.O_CREAT |
            constants.O_TRUNC |
            constants.O_NOFOLLOW,
        },
      );
      await chmod(dir, 0o755);
      const archive = join(root, job.id, `${job.execution}.tar.gz`);
      await new Promise<void>((res, rej) => {
        const sink = createWriteStream(archive, { mode: 0o600 });
        const p = spawn("tar", ["-czf", "-", "-C", dir, "."], {
          uid: 1000,
          gid: 1000,
          stdio: ["ignore", "pipe", "ignore"],
        });
        p.stdout.pipe(sink);
        p.once("error", rej);
        sink.once("error", rej);
        p.once("close", (c) => {
          if (c !== 0) rej(Error("Evidence archive failed"));
          else if (sink.writableFinished) res();
          else sink.once("finish", res);
        });
      });
      if ((await stat(archive)).size > MAX_EVIDENCE_ARCHIVE_BYTES)
        throw Error(
          "Evidence archive exceeds 64 MiB; retained on worker for inspection",
        );
      const bytes = await readFile(archive);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const url = await client.mutation(api.research.upload, { secret });
      const upload = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/gzip" },
        body: bytes,
      });
      if (!upload.ok) throw Error("Evidence upload failed");
      const { storageId } = (await upload.json()) as { storageId: any };
      await client.mutation(api.research.settle, {
        ...auth,
        id: job.id,
        execution: job.execution,
        report: JSON.stringify(report),
        archiveId: storageId,
        sha256,
      });
      settled = true;
      console.log(
        JSON.stringify({
          event: "checkpoint",
          job: job.id,
          phase: job.phase,
          replay,
          at: new Date().toISOString(),
        }),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Research failed";
      console.error(
        JSON.stringify({
          event: "job-stopped",
          job: job.id,
          error: message.slice(0, 200),
        }),
      );
      const active = JSON.parse(await readFile(ledgerFile, "utf8"));
      if (active) {
        stopping = true;
        throw Error(
          "Unsettled remote call retained; worker stopped to prevent duplicate work",
        );
      }
      if (!settled)
        await client.mutation(api.research.settle, {
          ...auth,
          id: job.id,
          execution: job.execution,
          error: message,
        });
    } finally {
      // Only the active attempt is readable by the agent. Prior evidence and notes
      // are retained for inspection under a root-only directory.
      await chown(dir, 0, 0);
      await chmod(dir, 0o700);
    }
  } catch (e) {
    console.error(
      JSON.stringify({
        event: "worker-stopped",
        error: e instanceof Error ? e.message : "Unknown error",
      }),
    );
    stopping = true;
    stopChild?.();
  }
}

clearInterval(leaseTimer);
