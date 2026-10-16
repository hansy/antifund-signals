import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  OpportunityMarket,
  OpportunityMarketSources,
} from "../src/components/OpportunityStage";
import {
  marketRange,
  reportedMarketLabel,
  factorValue,
} from "../src/lib/market-sizing";
import { lifecycleViewSchema } from "../src/lib/opportunity-lifecycle";
import {
  researchReportSchema,
  validateResearchMarket,
} from "../scripts/research-report";
import {
  researchInstructionsVersion,
  researchPrompt,
} from "../scripts/research-instructions";
import snapshot from "../data/opportunities.json";
import collection from "../data/opportunity-collection.json";
import corpus from "../data/corpus.json";

const view = lifecycleViewSchema.parse(snapshot);
const ai = view.opportunities.find((o) => o.id === "synthesis-o01")!.accepted;
const models = view.opportunities.filter((o) => o.accepted.marketSizing);

test("all 12 main opportunities display named reported markets without promoting leads", () => {
  const main = collection.records
    .filter((r) => r.placement === "opportunity")
    .map((r) => r.id)
    .sort();
  expect(models.map((o) => o.id).sort()).toEqual(main);
  for (const o of models) {
    const m = o.accepted.marketSizing!;
    expect(o.maturity).toBe("first-impressions");
    expect(o.qualificationReviewId).toBeNull();
    expect(m.confidence).toBe("low");
    expect(m.factors.some((f) => f.basis === "reported")).toBe(true);
    expect(m.factors.some((f) => f.basis === "assumption")).toBe(true);
    expect(m.growth.sourceIds.length).toBeGreaterThan(0);
    expect(m.growth.limitation.length).toBeGreaterThan(20);
    expect(o.accepted.content.marketSize).toHaveLength(1);
    const reported = o.accepted.reportedMarket!;
    expect(reported.name.length).toBeGreaterThan(0);
    expect(reported.end.year).toBeGreaterThan(reported.start.year);
    expect(
      reported.sourceIds.every((id) =>
        o.accepted.evidence.some(
          (e) => e.id === id && e.checks.status === "passed",
        ),
      ),
    ).toBe(true);
    expect(
      corpus.insights.find((c) => c.id === o.id)?.brief.marketSize?.value,
    ).toBe(reportedMarketLabel(reported));
  }
});

test("scenarios use annual spending and divide uncertain fleet sizes in the right direction", () => {
  expect(marketRange(ai.marketSizing!)).toEqual({
    low: 25_000_000,
    high: 375_000_000,
  });
  const drone = models.find((o) => o.id === "compact-survey-maps")!.accepted
    .marketSizing!;
  expect(marketRange(drone).low).toBeCloseTo(((424516 * 0.1) / 5) * 1000, 4);
  expect(marketRange(drone).high).toBeCloseTo(((424516 * 0.25) / 2) * 3990, 4);
  const laundry = models.find((o) => o.id === "laundry-folding")!.accepted
    .marketSizing!;
  expect(marketRange(laundry).low).toBeCloseTo(2326000, 4);
  expect(marketRange(laundry).high).toBeCloseTo(20934000, 4);
  expect(laundry.basis).toBe("annualized-equipment-spend");
  expect(factorValue(ai.marketSizing!.factors[1]!)).toBe("20%–40%");
});

test("invalid ranges, zero denominators and unresolved evidence references fail closed", () => {
  for (const corrupt of [
    (r: typeof ai) => {
      r.marketSizing!.factors[0]!.low = -1;
    },
    (r: typeof ai) => {
      r.marketSizing!.factors[0]!.high = 0;
    },
    (r: typeof ai) => {
      r.marketSizing!.factors[0]!.sourceIds = [];
    },
    (r: typeof ai) => {
      r.marketSizing!.growth.sourceIds = ["missing"];
    },
    (r: typeof ai) => {
      r.marketSizing!.factors[0]!.operation = "divide";
      r.marketSizing!.factors[0]!.low = 0;
    },
    (r: typeof ai) => {
      r.evidence.find(
        (e) => e.id === r.marketSizing!.factors[0]!.sourceIds[0],
      )!.checks.status = "failed";
    },
  ]) {
    const changed = structuredClone(snapshot);
    const o = changed.opportunities.find((o) => o.id === ai.opportunityId)!;
    corrupt(o.accepted as typeof ai);
    expect(lifecycleViewSchema.safeParse(changed).success).toBe(false);
  }
});

test("market display names the market and shows dated estimates and matched growth", () => {
  const html = renderToStaticMarkup(
    createElement(OpportunityMarket, { revision: ai }),
  );
  expect(html).not.toContain("Estimated annual spend");
  expect(html).not.toContain("How it’s calculated");
  expect(html).not.toContain("Assumption");
  expect(html).not.toContain("Market momentum");
  expect(html).toContain(">3.2×</p>");
  expect(html).not.toContain("2024 estimate");
  expect(html).toContain("2025 estimate");
  expect(html).not.toContain("$11.5B");
  expect(html).toContain("$37B");
  expect(html).toContain("Enterprise generative AI spending");
  expect(html).not.toContain("$25M");
  expect(html).not.toContain("$375M");
  expect(html).toContain("market-metrics");
  expect(html).not.toContain("not measured demand");
  expect(html).not.toContain("menlovc.com");
  const sources = renderToStaticMarkup(
    createElement(OpportunityMarketSources, { revision: ai }),
  );
  expect(sources).toContain("menlovc.com");
  expect(sources).toContain("Market sources");
  expect(sources).toContain(
    ai.evidence
      .find((source) => source.id === ai.reportedMarket!.sourceIds[0])!
      .excerpt.replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#x27;"),
  );
  expect(html).not.toContain('open=""');
});

test("reported markets require chronological years and inspected source references", () => {
  for (const corrupt of [
    (r: typeof ai) => {
      r.reportedMarket!.end.year = r.reportedMarket!.start.year;
    },
    (r: typeof ai) => {
      r.reportedMarket!.sourceIds = ["missing"];
    },
    (r: typeof ai) => {
      r.evidence.find(
        (e) => e.id === r.reportedMarket!.sourceIds[0],
      )!.checks.status = "failed";
    },
  ]) {
    const changed = structuredClone(snapshot);
    corrupt(
      changed.opportunities.find((o) => o.id === ai.opportunityId)!
        .accepted as typeof ai,
    );
    expect(lifecycleViewSchema.safeParse(changed).success).toBe(false);
  }
  const forecast = models.find(
    (o) => o.id === "everyday-leg-assistance",
  )!.accepted;
  const html = renderToStaticMarkup(
    createElement(OpportunityMarket, { revision: forecast }),
  );
  expect(html).not.toContain("2033 forecast");
  expect(html).toContain("2026 estimate");
  expect(html).toContain("$694.5M");
  expect(html).not.toContain("$1.79B");
  expect(html).toContain("2026–2033");
  expect(html).toContain("Annual growth forecast");
  expect(html).toContain("Exoskeletons");
});

test("v4 market completion requires a model or explicit missing inputs; old reports retain compatibility", () => {
  const legacy = { summary: "Partial", claims: [], sources: [], gaps: [] };
  expect(researchInstructionsVersion).toBe("opportunity-research-v4");
  expect(
    researchReportSchema(
      "market-and-alternatives",
      "opportunity-research-v3",
    ).safeParse(legacy).success,
  ).toBe(true);
  expect(
    researchReportSchema(
      "market-and-alternatives",
      researchInstructionsVersion,
    ).safeParse(legacy).success,
  ).toBe(false);
  const report = {
    ...legacy,
    sources: [
      {
        id: "s1",
        url: "https://example.org",
        title: "Source",
        quote: "Count",
        pdfPage: null,
        publishedAt: null,
        artifactPath: null,
      },
    ],
    marketSizing: {
      status: "unresolved" as const,
      segment: "Testing tools",
      attemptedSourceIds: ["s1"],
      missingInputs: ["Number of paying teams"],
      reasonNoRange: "No defensible eligibility denominator",
      nextEvidence: "Identify active teams",
    },
  };
  expect(() =>
    validateResearchMarket(
      report,
      "market-and-alternatives",
      researchInstructionsVersion,
    ),
  ).not.toThrow();
  report.marketSizing.attemptedSourceIds = ["missing"];
  expect(() =>
    validateResearchMarket(
      report,
      "market-and-alternatives",
      researchInstructionsVersion,
    ),
  ).toThrow("Unknown attempted");
  const sized = {
    ...legacy,
    marketSizing: { status: "sized" as const, model: ai.marketSizing! },
  };
  expect(() =>
    validateResearchMarket(
      sized,
      "market-and-alternatives",
      researchInstructionsVersion,
    ),
  ).toThrow("Unknown market input source");
  expect(researchPrompt("market-and-alternatives")).toContain(
    "Salary is not willingness to pay",
  );
});
