import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireSecret } from "./security";
import snapshot from "../data/opportunities.json";
export const phases = [
  "problem-and-customer",
  "market-and-alternatives",
  "investment-case",
] as const;
const actor = v.union(v.literal("operator"), v.literal("test"));
export const enabled = () => process.env.RESEARCH_ENABLED === "true";
function workerAuth(secret: string) {
  if (
    !process.env.RESEARCH_WORKER_SECRET ||
    secret !== process.env.RESEARCH_WORKER_SECRET
  )
    throw Error("Unauthorized");
}
export async function interestChanged(
  ctx: MutationCtx,
  who: "operator" | "test",
  cardId: string,
  interested: boolean,
) {
  // Test preferences never consume a subscription. Explicit test jobs use the worker-only API.
  if (!enabled() || who === "test") return;
  const job = await ctx.db
    .query("researchJobs")
    .withIndex("by_actor_card", (q) => q.eq("actor", who).eq("cardId", cardId))
    .unique();
  const now = new Date().toISOString();
  if (!job) {
    if (interested)
      await ctx.db.insert("researchJobs", {
        actor: who,
        cardId,
        desired: true,
        status: "queued",
        execution: "",
        owner: "",
        attempts: 0,
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        failure: null,
        steps: [],
      });
    return;
  }
  if (job.status === "awaiting-inspection") return;
  if (interested && job.attempts >= 12)
    throw new ConvexError(
      "Research attempt limit reached. Review the retained results before continuing.",
    );
  // A rapid off/on still waits for the old process to exit before another claim.
  const status =
    job.status === "running" || job.status === "pausing"
      ? !interested || job.status === "pausing"
        ? "pausing"
        : "running"
      : interested
        ? "queued"
        : "paused";
  await ctx.db.patch(job._id, { desired: interested, status, updatedAt: now });
}
export const list = query({
  args: { secret: v.string(), actor },
  handler: async (ctx, a) => {
    requireSecret(a.secret);
    const jobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_actor_card", (q) => q.eq("actor", a.actor))
      .collect();
    return {
      enabled: enabled() && a.actor === "operator",
      jobs: jobs.map((j) => ({
        id: j._id,
        cardId: j.cardId,
        status: j.status,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
        startedAt: j.startedAt,
        completedSteps: j.steps.map((s) => s.name),
        failure: j.failure,
      })),
    };
  },
});
// Worker lease fences duplicate processes; an expired owner is never silently replayed.
export const acquire = mutation({
  args: { secret: v.string(), owner: v.string() },
  handler: async (ctx, a) => {
    workerAuth(a.secret);
    const now = Date.now();
    const lock = await ctx.db
      .query("researchWorker")
      .withIndex("by_name", (q) => q.eq("name", "agent37"))
      .unique();
    if (lock && lock.owner !== a.owner && lock.expires > now) return false;
    if (lock && lock.owner !== a.owner) {
      for (const job of await ctx.db.query("researchJobs").collect())
        if (job.status === "running" || job.status === "pausing")
          await ctx.db.patch(job._id, {
            status: job.desired ? "failed" : "paused",
            execution: "",
            owner: "",
            failure:
              "Worker interrupted. Saved steps are retained; toggle interest off and on to resume.",
            updatedAt: new Date().toISOString(),
          });
    }
    if (lock)
      await ctx.db.patch(lock._id, { owner: a.owner, expires: now + 30000 });
    else
      await ctx.db.insert("researchWorker", {
        name: "agent37",
        owner: a.owner,
        expires: now + 30000,
      });
    return true;
  },
});
async function own(ctx: MutationCtx, owner: string) {
  const lock = await ctx.db
    .query("researchWorker")
    .withIndex("by_name", (q) => q.eq("name", "agent37"))
    .unique();
  if (!lock || lock.owner !== owner || lock.expires < Date.now())
    throw Error("Worker lease lost");
}
export const claim = mutation({
  args: { secret: v.string(), owner: v.string() },
  handler: async (ctx, a) => {
    workerAuth(a.secret);
    await own(ctx, a.owner);
    if (!enabled()) return null;
    const jobs = await ctx.db.query("researchJobs").collect();
    if (jobs.some((j) => j.status === "running" || j.status === "pausing"))
      return null;
    const job = jobs
      .filter(
        (j) =>
          j.actor === "operator" &&
          j.status === "queued" &&
          j.desired &&
          j.attempts < 12,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!job) return null;
    const opportunity = snapshot.opportunities.find((o) => o.id === job.cardId);
    if (!opportunity) throw Error("Unknown signal");
    const execution = crypto.randomUUID(),
      now = new Date().toISOString();
    await ctx.db.patch(job._id, {
      execution,
      owner: a.owner,
      status: "running",
      attempts: job.attempts + 1,
      startedAt: job.startedAt ?? now,
      updatedAt: now,
      failure: null,
    });
    const notes = await ctx.db
      .query("signalNotes")
      .withIndex("by_signal", (q) =>
        q.eq("actor", job.actor).eq("cardId", job.cardId),
      )
      .collect();
    return {
      id: job._id,
      execution,
      phase: phases[job.steps.length]!,
      opportunity: opportunity.accepted,
      notes: notes
        .filter((n) => !n.deleted)
        .map((n) => ({ id: n.id, version: n.version, text: n.text })),
      steps: job.steps,
    };
  },
});
export const control = query({
  args: {
    secret: v.string(),
    id: v.id("researchJobs"),
    execution: v.string(),
    owner: v.string(),
  },
  handler: async (ctx, a) => {
    workerAuth(a.secret);
    const j = await ctx.db.get(a.id);
    const lock = await ctx.db
      .query("researchWorker")
      .withIndex("by_name", (q) => q.eq("name", "agent37"))
      .unique();
    return {
      stop:
        !enabled() ||
        !lock ||
        lock.owner !== a.owner ||
        lock.expires < Date.now() ||
        !j ||
        j.execution !== a.execution ||
        j.status !== "running" ||
        !j.desired,
    };
  },
});
export const upload = mutation({
  args: { secret: v.string() },
  handler: async (ctx, a) => {
    workerAuth(a.secret);
    return ctx.storage.generateUploadUrl();
  },
});
export const settle = mutation({
  args: {
    secret: v.string(),
    owner: v.string(),
    id: v.id("researchJobs"),
    execution: v.string(),
    report: v.optional(v.string()),
    archiveId: v.optional(v.id("_storage")),
    sha256: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    workerAuth(a.secret);
    await own(ctx, a.owner);
    const j = await ctx.db.get(a.id);
    if (
      !j ||
      j.execution !== a.execution ||
      j.owner !== a.owner ||
      !["running", "pausing"].includes(j.status)
    )
      throw Error("Stale execution");
    const now = new Date().toISOString(),
      steps = [...j.steps];
    if (a.report !== undefined) {
      if (
        a.report.length > 100000 ||
        !a.archiveId ||
        !a.sha256 ||
        !/^[a-f0-9]{64}$/.test(a.sha256)
      )
        throw Error("Invalid checkpoint");
      const file = await ctx.db.system.get(a.archiveId);
      if (!file || file.size > 25000000)
        throw Error("Missing or oversized evidence archive");
      steps.push({
        name: phases[steps.length]!,
        report: a.report,
        archiveId: a.archiveId,
        sha256: a.sha256,
        completedAt: now,
      });
    }
    const paused = j.status === "pausing" || !j.desired;
    const status =
      steps.length === phases.length
        ? "awaiting-inspection"
        : paused
          ? j.desired
            ? "queued"
            : "paused"
          : a.error
            ? "failed"
            : "queued";
    await ctx.db.patch(j._id, {
      steps,
      status,
      execution: "",
      owner: "",
      updatedAt: now,
      failure: a.error?.slice(0, 500) ?? null,
    });
  },
});
// Private inspection access only. Machine completion never changes accepted content.
export const inspect = query({
  args: { secret: v.string(), cardId: v.string() },
  handler: async (ctx, a) => {
    workerAuth(a.secret);
    const j = await ctx.db
      .query("researchJobs")
      .withIndex("by_actor_card", (q) =>
        q.eq("actor", "operator").eq("cardId", a.cardId),
      )
      .unique();
    if (!j) return null;
    return {
      ...j,
      steps: await Promise.all(
        j.steps.map(async (s) => ({
          ...s,
          archiveUrl: await ctx.storage.getUrl(s.archiveId),
        })),
      ),
    };
  },
});

export const activateInterested = mutation({
  args: { secret: v.string() },
  handler: async (ctx, a) => {
    workerAuth(a.secret);
    if (!enabled()) throw Error("Research is disabled");
    let queued = 0;
    for (const p of await ctx.db.query("demoPreferences").collect()) {
      if (p.actor !== "operator" || p.verdict !== "interested") continue;
      const existing = await ctx.db
        .query("researchJobs")
        .withIndex("by_actor_card", (q) =>
          q.eq("actor", p.actor).eq("cardId", p.cardId),
        )
        .unique();
      if (!existing) {
        await interestChanged(ctx, p.actor, p.cardId, true);
        queued++;
      }
    }
    return { queued };
  },
});
