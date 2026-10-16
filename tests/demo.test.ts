import { test, expect, beforeEach, afterEach } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { corpusSchema, insightSchema } from "../src/lib/contracts";
import { lifecycleViewSchema } from "../src/lib/opportunity-lifecycle";
import corpus from "../data/corpus.json";
import opportunities from "../data/opportunities.json";
import { feedback, voice, readBytes } from "../src/server/demo";
const modules = {
  "../convex/demo.ts": () => import("../convex/demo"),
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
};
const secret = "demo-test-capability";
const old = process.env.RESEARCH_WRITE_SECRET;
beforeEach(() => {
  process.env.RESEARCH_WRITE_SECRET = secret;
});
afterEach(() => {
  if (old === undefined) delete process.env.RESEARCH_WRITE_SECRET;
  else process.env.RESEARCH_WRITE_SECRET = old;
});
test("public snapshot retains evidence links, has no private feedback or active research", () => {
  const data = corpusSchema.parse(corpus);
  const view = lifecycleViewSchema.parse(opportunities);
  expect(data.insights.length).toBeGreaterThan(0);
  expect(view.opportunities.map((o) => o.id).sort()).toEqual(
    data.insights.map((i) => i.id).sort(),
  );
  expect(data.insights.some((i) => i.id === "synthesis-o03")).toBe(false);
  for (const insight of data.insights) {
    for (const id of insight.projectIds)
      expect(data.projects.some((p) => p.id === id)).toBe(true);
    for (const id of insight.sourceIds)
      expect(data.sources.some((s) => s.id === id)).toBe(true);
  }
  for (const p of data.projects)
    for (const e of p.evidence)
      expect(data.sources.some((s) => s.id === e.sourceId)).toBe(true);
  for (const o of view.opportunities) {
    expect(o.research).toBeNull();
    expect(o.draft).toBeNull();
    expect(o.verdict).toBeNull();
    expect(o.researchEnabled).toBe(false);
  }
  expect(JSON.stringify(opportunities)).not.toContain("/Users/");
});
test("an early lead can retain one supporting project without inventing corroboration", () => {
  const lead = corpus.insights.find((i) => i.id === "laundry-folding")!;
  expect(lead.projectIds).toHaveLength(1);
  expect(insightSchema.parse(lead).confidence).toBe("Early signal");
  expect(insightSchema.safeParse({ ...lead, projectIds: [] }).success).toBe(false);
  const record = opportunities.opportunities.find((o) => o.id === lead.id)!;
  expect(record.maturity).toBe("first-impressions");
  expect(record.qualificationReviewId).toBeNull();
  expect(record.accepted.marketSizing?.confidence).toBe("low");
  expect(record.accepted.claims.find(c => record.accepted.content.marketSize.includes(c.id))?.kind).toBe("estimate");
});
test("preferences persist idempotently, reject stale edits, and never enqueue work", async () => {
  const t = convexTest(schema, modules);
  const command = {
    actor: "test",
    cardId: "synthesis-o01",
    verdict: "interested",
    expectedVersion: 0,
    requestId: "first",
  };
  const write = (c: unknown) =>
    t.mutation(api.demo.prefer, { secret, command: JSON.stringify(c) });
  await write(command);
  await write(command);
  const read = () => t.query(api.demo.feedback, { secret, actor: "test" });
  expect((await read()).preferences).toEqual([
    { cardId: "synthesis-o01", verdict: "interested", version: 1 },
  ]);
  await expect(write({ ...command, requestId: "stale" })).rejects.toThrow(
    "changed",
  );
  await write({
    ...command,
    verdict: null,
    expectedVersion: 1,
    requestId: "clear",
  });
  expect((await read()).preferences[0]?.verdict).toBeNull();
  expect(
    (await t.query(api.demo.feedback, { secret, actor: "operator" }))
      .preferences,
  ).toEqual([]);
  await expect(
    write({ ...command, cardId: "missing", requestId: "bad" }),
  ).rejects.toThrow("Unknown");
  await expect(
    t.query(api.demo.feedback, { secret: "wrong", actor: "test" }),
  ).rejects.toThrow("Unauthorized");
  expect(Object.keys(await read()).sort()).toEqual([
    "preferences",
    "transcripts",
  ]);
});
test("recordings use one claim, cache settled transcripts, reject changed audio and cap costs", async () => {
  const t = convexTest(schema, modules);
  const args = {
    secret,
    actor: "test" as const,
    cardId: "synthesis-o01",
    segmentId: "segment",
    reviewer: "ui-test",
    digest: "digest",
  };
  const first = await t.mutation(api.demo.claimVoice, args);
  expect(first.token).toBeString();
  await expect(t.mutation(api.demo.claimVoice, args)).rejects.toThrow(
    "still transcribing",
  );
  await t.mutation(api.demo.finishVoice, {
    secret,
    actor: "test",
    segmentId: "segment",
    token: first.token!,
    text: "Editable words",
  });
  expect(await t.mutation(api.demo.claimVoice, args)).toEqual({
    text: "Editable words",
    token: null,
  });
  await expect(
    t.mutation(api.demo.claimVoice, { ...args, digest: "different" }),
  ).rejects.toThrow("identity changed");
  for (let i = 1; i < 50; i++)
    await t.mutation(api.demo.claimVoice, {
      ...args,
      segmentId: `segment-${i}`,
    });
  await expect(
    t.mutation(api.demo.claimVoice, { ...args, segmentId: "too-many" }),
  ).rejects.toThrow("limit");
  expect(
    (await t.query(api.demo.feedback, { secret, actor: "test" })).transcripts
      .segment?.text,
  ).toBe("Editable words");
});
test("anonymous endpoints reject cross-origin writes and bound request bodies", async () => {
  const req = new Request("https://demo.example/api/feedback", {
    method: "POST",
    headers: { origin: "https://other.example" },
    body: "{}",
  });
  expect(
    (
      await feedback(req, {
        CONVEX_URL: "https://test.convex.cloud",
        RESEARCH_WRITE_SECRET: secret,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await voice(
        new Request("https://demo.example/api/feedback/voice", {
          method: "POST",
          headers: { origin: "https://other.example" },
        }),
        {},
      )
    ).status,
  ).toBe(403);
  await expect(
    readBytes(
      new Request("https://demo.example", { method: "POST", body: "12345" }),
      4,
    ),
  ).rejects.toThrow("too large");
});
