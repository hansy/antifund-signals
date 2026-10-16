import { expect, test } from "bun:test";
import corpus from "../data/corpus.json";
import snapshot from "../data/opportunities.json";
import { corpusSchema } from "../src/lib/contracts";
import {
  collectionSchema,
  opportunityCollection,
  collectionEntries,
  collectionIncludes,
  supportingRecords,
} from "../src/lib/opportunity-collection";
import {
  researchInstructionsVersion,
  researchPrompt,
} from "../scripts/research-instructions";

const entries = collectionEntries(corpusSchema.parse(corpus).insights);
test("every saved signal has exactly one placement without changing its research identity", () => {
  expect(opportunityCollection.records.map((x) => x.id).sort()).toEqual(
    corpus.insights.map((x) => x.id).sort(),
  );
  expect(new Set(opportunityCollection.records.map((x) => x.id)).size).toBe(
    corpus.insights.length,
  );
  expect(snapshot.opportunities.map((x) => x.id).sort()).toEqual(
    corpus.insights.map((x) => x.id).sort(),
  );
  const main = entries.filter((x) => collectionIncludes(x, "main"));
  expect(main).toHaveLength(13);
  expect(main.filter((x) => x.group).map((x) => x.id)).toEqual([
    "group-flexible-energy",
  ]);
  for (const id of [
    "walking-freeze-cues",
    "reusable-metal-filters",
    "field-blood-transport",
    "gesture-robot-assistance",
  ])
    expect(
      entries
        .filter((x) => collectionIncludes(x, "project"))
        .some((x) => x.id === id),
    ).toBe(true);
  expect(main.some((x) => x.placement !== "opportunity")).toBe(false);
  // Virtual families are navigation only, never new research jobs or feedback identities.
  expect(
    opportunityCollection.groups.every(
      (g) => !snapshot.opportunities.some((x) => x.id === g.id),
    ),
  ).toBe(true);
});
test("supporting branches and project archives retain all source paths", () => {
  for (const record of opportunityCollection.records) {
    const insight = corpus.insights.find((x) => x.id === record.id)!;
    expect(
      insight.projectIds.every((id) =>
        corpus.projects.some((p) => p.id === id),
      ),
    ).toBe(true);
    expect(
      insight.sourceIds.every((id) => corpus.sources.some((s) => s.id === id)),
    ).toBe(true);
    if (record.parentId)
      expect(
        supportingRecords(record.parentId).some((x) => x.id === record.id),
      ).toBe(true);
  }
  expect(supportingRecords("synthesis-o02").map((x) => x.id)).toEqual([
    "cycling-scenario-tests",
    "terrain-fallback-tests",
  ]);
  expect(
    entries
      .filter((x) => collectionIncludes(x, "supporting"))
      .some((x) => x.id === "group-factory-quality"),
  ).toBe(true);
});
test("invalid parent links, nested cycles and duplicates cannot silently hide evidence", () => {
  const bad = structuredClone(opportunityCollection);
  bad.records.find((x) => x.placement === "supporting")!.parentId = "missing";
  expect(collectionSchema.safeParse(bad).success).toBe(false);
  bad.records.find((x) => x.placement === "supporting")!.parentId =
    "walking-freeze-cues";
  expect(collectionSchema.safeParse(bad).success).toBe(false);
  bad.records.push(bad.records[0]!);
  expect(collectionSchema.safeParse(bad).success).toBe(false);
});
test("unscreened additions are not automatically surfaced; new instructions preserve historical provenance", () => {
  const candidate = { ...corpus.insights[0]!, id: "unscreened-project" };
  expect(
    collectionEntries(
      corpusSchema.parse({
        ...corpus,
        insights: [...corpus.insights, candidate],
      }).insights,
    ).some((x) => x.id === candidate.id),
  ).toBe(false);
  expect(researchInstructionsVersion).toBe("opportunity-research-v3");
  expect(researchPrompt("investment-case")).toContain(
    "supporting branch or only a project",
  );
  expect(researchPrompt("investment-case")).toContain(
    "never change the collection or publish automatically",
  );
  expect(
    snapshot.opportunities.every(
      (x) =>
        x.accepted.assessment.rubricVersion !== ("venture-screen-v3" as string),
    ),
  ).toBe(true);
});
