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
