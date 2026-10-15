import { test, expect, beforeEach, afterEach } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
const modules = {
  "../convex/research.ts": () => import("../convex/research"),
  "../convex/demo.ts": () => import("../convex/demo"),
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
};
const previous = { ...process.env };
beforeEach(() => {
  process.env.RESEARCH_ENABLED = "true";
  process.env.RESEARCH_WRITE_SECRET = "web";
  process.env.RESEARCH_WORKER_SECRET = "worker";
});
afterEach(() => {
  for (const k of [
    "RESEARCH_ENABLED",
    "RESEARCH_WRITE_SECRET",
    "RESEARCH_WORKER_SECRET",
  ]) {
    if (previous[k] === undefined) delete process.env[k];
    else process.env[k] = previous[k];
  }
});
const auth = { secret: "worker", owner: "first" };
const command = (
  verdict: string | null,
  expectedVersion: number,
  requestId: string,
  actor = "operator",
) => ({
  secret: "web",
  command: JSON.stringify({
    actor,
    cardId: "synthesis-o01",
    verdict,
    expectedVersion,
    requestId,
  }),
});
test("explicit batch resume restores only pause cancellations and preserves checkpoints", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.research.requestAll, { secret: "worker" });
  const jobs = await t.run((ctx) => ctx.db.query("researchJobs").collect());
  const [stopped, broken, exhausted] = jobs;
  const archiveId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["retained"])),
  );
  const steps = [
    {
      name: "problem-and-customer",
      report: "{}",
      archiveId,
      sha256: "a".repeat(64),
      completedAt: new Date().toISOString(),
    },
  ];
  await t.run(async (ctx) => {
    await ctx.db.patch(stopped!._id, {
      status: "failed",
      failure: "Research stopped; completed steps preserved.",
      steps,
      attempts: 2,
    });
    await ctx.db.patch(broken!._id, {
      status: "failed",
      failure: "Source validation failed",
    });
    await ctx.db.patch(exhausted!._id, {
      status: "failed",
      failure: "Research stopped; completed steps preserved.",
      attempts: 12,
    });
  });
  expect(
    (await t.mutation(api.research.requestAll, { secret: "worker" })).blocked,
  ).toContain(stopped!.cardId);
  await expect(
    t.mutation(api.research.requestAll, { secret: "web", resumeStopped: true }),
  ).rejects.toThrow("Unauthorized");
  const result = await t.mutation(api.research.requestAll, {
    secret: "worker",
    resumeStopped: true,
  });
  expect(result.resumed).toEqual([stopped!.cardId]);
  expect(result.blocked).toContain(broken!.cardId);
  expect(result.blocked).toContain(exhausted!.cardId);
  const after = await t.run((ctx) => ctx.db.get(stopped!._id));
  expect(after!.steps).toEqual(steps);
  expect(after!.attempts).toBe(2);
  expect(after!.status).toBe("queued");
  expect(
    (
      await t.mutation(api.research.requestAll, {
        secret: "worker",
        resumeStopped: true,
      })
    ).resumed,
  ).toEqual([]);
  expect(
    await t.run((ctx) => ctx.db.query("researchJobs").collect()),
  ).toHaveLength(jobs.length);
});
test("one job, one owner, prompt pause; rapid resume waits for old execution to finish", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.demo.prefer, command("interested", 0, "a"));
  await t.mutation(api.demo.prefer, command("interested", 0, "a"));
  expect(await t.mutation(api.research.acquire, auth)).toBe(true);
  expect(
    await t.mutation(api.research.acquire, { ...auth, owner: "second" }),
  ).toBe(false);
  const j = (await t.mutation(api.research.claim, auth))!;
  expect(j.phase).toBe("problem-and-customer");
  expect(await t.mutation(api.research.claim, auth)).toBeNull();
  await t.mutation(api.demo.prefer, command(null, 1, "b"));
  const control = { ...auth, id: j.id, execution: j.execution };
  expect((await t.query(api.research.control, control)).stop).toBe(true);
  await t.mutation(api.demo.prefer, command("interested", 2, "c"));
  expect((await t.query(api.research.control, control)).stop).toBe(true);
  expect(await t.mutation(api.research.claim, auth)).toBeNull();
  await t.mutation(api.research.settle, { ...control, error: "Stopped" });
  const resumed = (await t.mutation(api.research.claim, auth))!;
  expect(resumed.id).toBe(j.id);
  expect(resumed.execution).not.toBe(j.execution);
  await expect(
    t.mutation(api.research.settle, { ...control, error: "late" }),
  ).rejects.toThrow("Stale");
  const jobs = await t.query(api.research.list, {
    secret: "web",
    actor: "operator",
  });
  expect(jobs.jobs).toHaveLength(1);
});
test("completed steps survive pauses; completion awaits inspection and never repeats", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.research.acquire, auth);
  await t.mutation(api.demo.prefer, command("interested", 0, "a"));
  let j = (await t.mutation(api.research.claim, auth))!;
  const archiveId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["retained evidence"])),
  );
  const finish = () =>
    t.mutation(api.research.settle, {
      ...auth,
      id: j.id,
      execution: j.execution,
      report: "{}",
      archiveId,
      sha256: "a".repeat(64),
    });
  await t.mutation(api.demo.prefer, command(null, 1, "b"));
  await finish();
  expect(
    (await t.query(api.research.list, { secret: "web", actor: "operator" }))
      .jobs[0]?.status,
  ).toBe("paused");
  await t.mutation(api.demo.prefer, command("interested", 2, "c"));
  j = (await t.mutation(api.research.claim, auth))!;
  expect(j.phase).toBe("market-and-alternatives");
  expect(j.steps).toHaveLength(1);
  await finish();
  j = (await t.mutation(api.research.claim, auth))!;
  expect(j.phase).toBe("investment-case");
  await finish();
  expect(
    (await t.query(api.research.list, { secret: "web", actor: "operator" }))
      .jobs[0]?.status,
  ).toBe("awaiting-inspection");
  await t.mutation(api.demo.prefer, command(null, 3, "d"));
  await t.mutation(api.demo.prefer, command("interested", 4, "e"));
  expect(await t.mutation(api.research.claim, auth)).toBeNull();
  const view = await t.query(api.research.list, {
    secret: "web",
    actor: "operator",
  });
  expect(JSON.stringify(view)).not.toContain("report");
  expect(JSON.stringify(view)).not.toContain("archiveId");
});
test("lost worker is fenced and not silently replayed; test preferences do not run research", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.demo.prefer, command("interested", 0, "a", "test"));
  expect(
    (await t.query(api.research.list, { secret: "web", actor: "test" })).jobs,
  ).toHaveLength(0);
  await t.mutation(api.demo.prefer, command("interested", 0, "a"));
  await t.mutation(api.research.acquire, auth);
  const j = (await t.mutation(api.research.claim, auth))!;
  await t.run(async (ctx) => {
    const lock = (await ctx.db.query("researchWorker").collect())[0]!;
    await ctx.db.patch(lock._id, { expires: 0 });
  });
  const other = { ...auth, owner: "second" };
  expect(await t.mutation(api.research.acquire, other)).toBe(true);
  expect(await t.mutation(api.research.claim, other)).toBeNull();
  expect(
    (
      await t.query(api.research.control, {
        ...auth,
        id: j.id,
        execution: j.execution,
      })
    ).stop,
  ).toBe(true);
  expect(
    (await t.query(api.research.list, { secret: "web", actor: "operator" }))
      .jobs[0]?.status,
  ).toBe("failed");
  await expect(
    t.mutation(api.research.acquire, { secret: "web", owner: "third" }),
  ).rejects.toThrow("Unauthorized");
});
test("confirmed restart resumes unfinished work from its checkpoint and respects paused interest", async () => {
  for (const desired of [true, false]) {
    const t = convexTest(schema, modules);
    await t.mutation(api.research.acquire, auth);
    await t.mutation(api.demo.prefer, command("interested", 0, "a"));
    const first = (await t.mutation(api.research.claim, auth))!;
    const archiveId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["checkpoint"])),
    );
    await t.mutation(api.research.settle, {
      ...auth,
      id: first.id,
      execution: first.execution,
      report: "{}",
      archiveId,
      sha256: "b".repeat(64),
    });
    const interrupted = (await t.mutation(api.research.claim, auth))!;
    if (!desired) await t.mutation(api.demo.prefer, command(null, 1, "pause"));
    const next = { secret: "worker", owner: "after-reboot" };
    expect(
      await t.mutation(api.research.acquire, {
        ...next,
        reconciledOwner: auth.owner,
      }),
    ).toBe(false);
    await t.run(async (ctx) => {
      const lock = (await ctx.db.query("researchWorker").collect())[0]!;
      await ctx.db.patch(lock._id, { expires: 0 });
    });
    await t.mutation(api.research.acquire, {
      ...next,
      reconciledOwner: auth.owner,
    });
    const resumed = await t.mutation(api.research.claim, next);
    if (desired) {
      expect(resumed?.id).toBe(first.id);
      expect(resumed?.phase).toBe("market-and-alternatives");
      expect(resumed?.steps[0]?.sha256).toBe("b".repeat(64));
      expect(resumed?.execution).not.toBe(interrupted.execution);
    } else {
      expect(resumed).toBeNull();
      expect(
        (await t.query(api.research.list, { secret: "web", actor: "operator" }))
          .jobs[0]?.status,
      ).toBe("paused");
    }
    await expect(
      t.mutation(api.research.settle, {
        ...auth,
        id: interrupted.id,
        execution: interrupted.execution,
        error: "late",
      }),
    ).rejects.toThrow();
  }
});

test("explicit collection research is idempotent, private, and independent of interest", async () => {
  const t = convexTest(schema, modules);
  const snapshot = (await import("../data/opportunities.json")).default;
  await expect(
    t.mutation(api.research.requestAll, { secret: "web" }),
  ).rejects.toThrow("Unauthorized");
  process.env.RESEARCH_ENABLED = "false";
  await expect(
    t.mutation(api.research.requestAll, { secret: "worker" }),
  ).rejects.toThrow("disabled");
  process.env.RESEARCH_ENABLED = "true";
  const first = await t.mutation(api.research.requestAll, { secret: "worker" });
  expect(first.created.sort()).toEqual(
    snapshot.opportunities.map((o) => o.id).sort(),
  );
  expect(
    (await t.mutation(api.research.requestAll, { secret: "worker" })).created,
  ).toEqual([]);
  expect(
    await t.run((ctx) => ctx.db.query("demoPreferences").collect()),
  ).toEqual([]);
  expect(
    (await t.query(api.research.list, { secret: "web", actor: "test" })).jobs,
  ).toEqual([]);
  await t.mutation(api.research.acquire, auth);
  const active = (await t.mutation(api.research.claim, auth))!;
  await t.mutation(api.demo.prefer, {
    secret: "web",
    command: JSON.stringify({
      actor: "operator",
      cardId: active.opportunity.opportunityId,
      verdict: "not-interested",
      expectedVersion: 0,
      requestId: "no",
    }),
  });
  expect(
    (
      await t.query(api.research.control, {
        ...auth,
        id: active.id,
        execution: active.execution,
      })
    ).stop,
  ).toBe(false);
  await t.mutation(api.research.requestAll, { secret: "worker" });
  expect(await t.mutation(api.research.claim, auth)).toBeNull();
  const jobs = await t.query(api.research.list, {
    secret: "web",
    actor: "operator",
  });
  expect(jobs.jobs).toHaveLength(snapshot.opportunities.length);
  expect(jobs.jobs.every((j) => j.independentlyRequested)).toBe(true);
});

test("batch preserves completed research and checkpoint bytes, resumes paused work, and exposes failures", async () => {
  const t = convexTest(schema, modules);
  const snapshot = (await import("../data/opportunities.json")).default;
  const [done, paused, failed] = snapshot.opportunities;
  const seeded = await t.run(async (ctx) => {
    const archiveId = await ctx.storage.store(new Blob(["original evidence"]));
    const step = {
      name: "problem-and-customer",
      report: '{"original":true}',
      archiveId,
      sha256: "c".repeat(64),
      completedAt: "2026-10-15T00:00:00.000Z",
    };
    const common = {
      actor: "operator" as const,
      desired: false,
      execution: "",
      owner: "",
      attempts: 3,
      createdAt: "2026-10-15T00:00:00.000Z",
      updatedAt: "2026-10-15T00:00:00.000Z",
      startedAt: null,
      failure: null,
    };
    const ids = await Promise.all([
      ctx.db.insert("researchJobs", {
        ...common,
        cardId: done!.id,
        status: "awaiting-inspection",
        steps: [
          step,
          { ...step, name: "market-and-alternatives" },
          { ...step, name: "investment-case" },
        ],
      }),
      ctx.db.insert("researchJobs", {
        ...common,
        cardId: paused!.id,
        status: "paused",
        steps: [step],
      }),
      ctx.db.insert("researchJobs", {
        ...common,
        cardId: failed!.id,
        status: "failed",
        failure: "retained error",
        steps: [step],
      }),
    ]);
    return await Promise.all(ids.map((id) => ctx.db.get(id)));
  });
  const result = await t.mutation(api.research.requestAll, {
    secret: "worker",
  });
  expect(result.preserved).toContain(done!.id);
  expect(result.resumed).toEqual([paused!.id]);
  expect(result.blocked).toEqual([failed!.id]);
  const after = await t.run((ctx) =>
    Promise.all(seeded.map((j) => ctx.db.get(j!._id))),
  );
  expect(after[0]).toEqual(seeded[0]);
  expect(after[1]?.steps).toEqual(seeded[1]?.steps);
  expect(after[1]?.status).toBe("queued");
  expect(after[2]).toEqual(seeded[2]);
  await t.mutation(api.research.acquire, auth);
  const resumed = (await t.mutation(api.research.claim, auth))!;
  expect(resumed.id).toBe(seeded[1]!._id);
  expect(resumed.phase).toBe("market-and-alternatives");
  expect(resumed.steps).toEqual(seeded[1]!.steps);
});

test("batch adopts an active final attempt without resetting its budget or stranding a queued job", async () => {
  for (const pausing of [false, true]) {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.prefer, command("interested", 0, "start"));
    await t.mutation(api.research.acquire, auth);
    const job = (await t.mutation(api.research.claim, auth))!;
    if (pausing) await t.mutation(api.demo.prefer, command(null, 1, "pause"));
    await t.run((ctx) => ctx.db.patch(job.id, { attempts: 12 }));
    const result = await t.mutation(api.research.requestAll, {
      secret: "worker",
    });
    expect(result.blocked).not.toContain("synthesis-o01");
    const adopted = await t.run((ctx) => ctx.db.get(job.id));
    expect(adopted?.execution).toBe(job.execution);
    expect(adopted?.desired).toBe(true);
    expect(adopted?.batchRequestedAt).toBeTruthy();
    expect(adopted?.attempts).toBe(12);
    const archiveId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["final attempt evidence"])),
    );
    await t.mutation(api.research.settle, {
      ...auth,
      id: job.id,
      execution: job.execution,
      report: "{}",
      archiveId,
      sha256: "d".repeat(64),
    });
    const ended = await t.run((ctx) => ctx.db.get(job.id));
    expect(ended?.status).toBe("failed");
    expect(ended?.failure).toContain("attempt limit");
    expect(ended?.steps).toHaveLength(1);
    expect(
      (await t.mutation(api.research.requestAll, { secret: "worker" })).blocked,
    ).toContain("synthesis-o01");
  }
});

test("review completion requires exact checkpoints, deployed revision and audit, and never reruns", async () => {
  const t = convexTest(schema, modules);
  const s = (
    await import("../data/opportunities.json")
  ).default.opportunities.find((o) => o.id === "synthesis-o01")!;
  await t.mutation(api.demo.prefer, command("interested", 0, "start"));
  await t.mutation(api.research.acquire, auth);
  const archiveId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["audit and evidence"])),
  );
  for (let i = 0; i < 3; i++) {
    const j = (await t.mutation(api.research.claim, auth))!;
    await t.mutation(api.research.settle, {
      ...auth,
      id: j.id,
      execution: j.execution,
      report: "{}",
      archiveId,
      sha256: "a".repeat(64),
    });
  }
  const args = {
    secret: "worker",
    cardId: s.id,
    reviewId: "review-test",
    checkpointHashes: Array(3).fill("a".repeat(64)),
    auditArchiveId: archiveId,
    auditSha256: new Bun.CryptoHasher("sha256")
      .update("audit and evidence")
      .digest("hex"),
    publishedRevisionId: s.accepted.id,
    publishedRevisionHash: s.accepted.contentHash,
  };
  await expect(
    t.mutation(api.research.completeReview, { ...args, secret: "web" }),
  ).rejects.toThrow("Unauthorized");
  await expect(
    t.mutation(api.research.completeReview, { ...args, checkpointHashes: [] }),
  ).rejects.toThrow("Stale");
  await expect(
    t.mutation(api.research.completeReview, {
      ...args,
      publishedRevisionHash: "c".repeat(64),
    }),
  ).rejects.toThrow("Published");
  await expect(
    t.mutation(api.research.completeReview, { ...args, auditSha256: "" }),
  ).rejects.toThrow("audit");
  await expect(
    t.mutation(api.research.completeReview, {
      ...args,
      auditSha256: "b".repeat(64),
    }),
  ).rejects.toThrow("checksum");
  const result = await t.mutation(api.research.completeReview, args);
  expect(result.status).toBe("completed");
  expect(await t.mutation(api.research.completeReview, args)).toEqual(result);
  await expect(
    t.mutation(api.research.completeReview, { ...args, reviewId: "other" }),
  ).rejects.toThrow("different");
  await t.mutation(api.demo.prefer, command(null, 1, "off"));
  await t.mutation(api.demo.prefer, command("interested", 2, "on"));
  expect(await t.mutation(api.research.claim, auth)).toBeNull();
  expect(
    (await t.mutation(api.research.requestAll, { secret: "worker" })).preserved,
  ).toContain(s.id);
  const view = await t.query(api.research.list, {
    secret: "web",
    actor: "operator",
  });
  const done = view.jobs.find((j) => j.cardId === s.id)!;
  expect(done.status).toBe("completed");
  expect(done.review?.publishedRevisionHash).toBe(s.accepted.contentHash);
  expect(JSON.stringify(view)).not.toContain("auditArchiveId");
});
