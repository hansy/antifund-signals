import { expect, test } from "bun:test";
import { lifecycleViewSchema } from "../src/lib/opportunity-lifecycle";
import opportunities from "../data/opportunities.json";
import corpus from "../data/corpus.json";
import { createHash } from "node:crypto";

test("published lead revisions retain valid evidence references and hashes without automatic qualification", () => {
  const canonical = (value: unknown): string =>
    Array.isArray(value)
      ? "[" + value.map(canonical).join(",") + "]"
      : value && typeof value === "object"
        ? "{" +
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
            .join(",") +
          "}"
        : JSON.stringify(value);
  const view = lifecycleViewSchema.parse(opportunities);
  for (const o of view.opportunities) {
    const r = o.accepted,
      { contentHash, ...payload } = r;
    expect(createHash("sha256").update(canonical(payload)).digest("hex")).toBe(
      contentHash,
    );
    const claims = new Set(r.claims.map((c) => c.id)),
      evidence = new Set(r.evidence.map((e) => e.id));
    expect(claims.size).toBe(r.claims.length);
    expect(evidence.size).toBe(r.evidence.length);
    const refs = [
      r.content.what,
      r.content.problem,
      r.content.opportunity,
      ...r.content.customers.map((c) => c.claimId),
      ...r.content.applications,
      ...r.content.alternatives,
      ...r.content.marketSize,
      ...r.content.economics,
      ...r.content.timing,
      ...r.projects.map((p) => p.contributionClaimId),
      ...Object.values(r.assessment.dimensions).flatMap((d) => d.claimIds),
    ];
    expect(refs.every((id) => claims.has(id))).toBe(true);
    expect(
      r.claims.every((c) => c.evidenceIds.every((id) => evidence.has(id))),
    ).toBe(true);
    expect(
      r.projects.every((p) =>
        corpus.projects.some((c) => c.id === p.projectId),
      ),
    ).toBe(true);
    if (r.producerId === "rubric-reassessment-v2") {
      expect(o.maturity).toBe("first-impressions");
      expect(o.qualificationReviewId).toBeNull();
      expect(r.content.marketSize).toEqual([]);
    }
  }
});

test("revised rubric accepts new assessments without relabeling historical evidence", () => {
  const original = lifecycleViewSchema.parse(opportunities);
  const revised = structuredClone(opportunities);
  revised.opportunities[0]!.accepted.assessment.rubricVersion =
    "venture-screen-v1";
  expect(lifecycleViewSchema.safeParse(revised).success).toBe(true);
  revised.opportunities[0]!.accepted.assessment.rubricVersion =
    "venture-screen-v2";
  const parsed = lifecycleViewSchema.parse(revised);
  expect(parsed.opportunities[0]!.accepted.assessment.rubricVersion).toBe(
    "venture-screen-v2",
  );
  expect(parsed.opportunities[0]!.accepted.claims).toEqual(
    original.opportunities[0]!.accepted.claims,
  );
  expect(parsed.opportunities[0]!.maturity).toBe(
    original.opportunities[0]!.maturity,
  );
  expect(
    opportunities.opportunities[0]!.accepted.assessment.rubricVersion,
  ).toBe(original.opportunities[0]!.accepted.assessment.rubricVersion);
  revised.opportunities[0]!.accepted.assessment.rubricVersion =
    "venture-screen-unrecognized";
  expect(lifecycleViewSchema.safeParse(revised).success).toBe(false);
});
