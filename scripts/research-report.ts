import { z } from "zod";
import { marketSizingSchema, marketIssues } from "../src/lib/market-sizing";
const source = z
  .object({
    id: z.string(),
    url: z.url(),
    title: z.string(),
    quote: z.string(),
    pdfPage: z.number().int().positive().nullable(),
    publishedAt: z.string().nullable(),
    artifactPath: z.string().nullable(),
  })
  .strict();
export const legacyReportSchema = z
  .object({
    summary: z.string(),
    claims: z.array(
      z
        .object({
          text: z.string(),
          kind: z.enum(["reported", "inference", "estimate", "hypothesis"]),
          sourceIds: z.array(z.string()),
          limitations: z.array(z.string()),
        })
        .strict(),
    ),
    sources: z.array(source),
    gaps: z.array(z.string()),
  })
  .strict();

export const marketResearchSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("sized"), model: marketSizingSchema }).strict(),
  z
    .object({
      status: z.literal("unresolved"),
      segment: z.string().min(1),
      attemptedSourceIds: z.array(z.string().min(1)).min(1),
      missingInputs: z.array(z.string().min(1)).min(1),
      reasonNoRange: z.string().min(1),
      nextEvidence: z.string().min(1),
    })
    .strict(),
]);
const currentReportSchema = legacyReportSchema.extend({
  marketSizing: marketResearchSchema.optional(),
});
export function researchReportSchema(phase: string, version: string) {
  return phase === "market-and-alternatives" &&
    version === "opportunity-research-v4"
    ? currentReportSchema.extend({ marketSizing: marketResearchSchema })
    : currentReportSchema;
}
export function validateResearchMarket(
  report: z.infer<typeof currentReportSchema>,
  phase: string,
  version: string,
) {
  if (
    phase !== "market-and-alternatives" ||
    version !== "opportunity-research-v4"
  )
    return;
  const result = report.marketSizing;
  if (!result)
    throw Error(
      "Market phase needs a sizing result or explicit unresolved inputs",
    );
  const ids = new Set(report.sources.map((s) => s.id));
  const issues =
    result.status === "sized"
      ? marketIssues(result.model, ids)
      : result.attemptedSourceIds.some((id) => !ids.has(id))
        ? ["Unknown attempted market source"]
        : [];
  if (issues.length) throw Error(issues.join("; "));
}
