import { z } from "zod";
const id = z.string().min(1);
const time = z.iso.datetime();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const dimensions = [
  "problem",
  "customerPayment",
  "productValue",
  "commercialGap",
  "ventureScale",
  "businessCapital",
  "timing",
] as const;
const confidence = z.enum(["low", "moderate", "high"]);
export const quantitySchema = z
  .object({
    low: z.number().finite(),
    high: z.number().finite(),
    unit: id,
    population: id,
    geography: id,
    period: id,
    marketScope: z.enum(["reachable-segment", "broader-context", "not-market"]),
  })
  .strict()
  .refine((q) => q.low <= q.high, "Invalid quantity range");
const claimBase = {
  id,
  text: id,
  evidenceIds: z.array(id),
  derivedFromClaimIds: z.array(id),
  confidence,
  limitations: z.array(z.string()),
  review: z
    .object({
      status: z.enum(["unreviewed", "accepted", "rejected"]),
      reviewerId: id.nullable(),
      reviewedAt: time.nullable(),
      reason: z.string().nullable(),
    })
    .strict(),
};
export const opportunityClaimSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...claimBase,
      kind: z.literal("reported"),
      attribution: id,
      quantity: quantitySchema.nullable(),
    })
    .strict(),
  z
    .object({ ...claimBase, kind: z.literal("inference"), reasoning: id })
    .strict(),
  z
    .object({ ...claimBase, kind: z.literal("hypothesis"), testQuestion: id })
    .strict(),
  z
    .object({
      ...claimBase,
      kind: z.literal("estimate"),
      quantity: quantitySchema.nullable(),
      calculation: z
        .object({
          expression: id,
          inputs: z.array(z.object({ name: id, claimId: id }).strict()).min(1),
          assumptions: z.array(z.string()),
        })
        .strict(),
    })
    .strict(),
]);
export const opportunityEvidenceSchema = z
  .object({
    id,
    sourceUrl: z.url(),
    finalUrl: z.url().nullable(),
    title: id,
    publisher: z.string().nullable(),
    sourceRole: z.enum(["primary", "secondary"]),
    independence: z.enum(["project-originated", "external", "unknown"]),
    publishedAt: z.string().nullable(),
    observationPeriod: z.string().nullable(),
    retrievedAt: z.string().nullable(),
    excerpt: id,
    pdfPage: z.number().int().positive().nullable(),
    locator: z.string().nullable(),
    relevance: z.enum(["direct", "broader-context"]),
    artifactId: id.nullable(),
    checks: z
      .object({
        status: z.enum(["pending", "passed", "failed"]),
        checkedAt: time.nullable(),
        failureIds: z.array(id),
      })
      .strict(),
  })
  .strict();
const judgment = z
  .object({
    status: z.enum(["supported", "plausible", "missing", "contradicted"]),
    reason: id,
    claimIds: z.array(id),
  })
  .strict();
export const opportunityRevisionSchema = z
  .object({
    id,
    opportunityId: id,
    parentRevisionId: id.nullable(),
    createdAt: time,
    producerId: id,
    origin: z.enum([
      "saved-data-synthesis",
      "research",
      "inspection-correction",
    ]),
    changeReason: id,
    contentHash: hash,
    title: id,
    classifications: z.array(id),
    content: z
      .object({
        what: id,
        problem: id,
        opportunity: id,
        customers: z.array(
          z
            .object({
              role: z.enum(["user", "buyer", "budget-owner"]),
              claimId: id,
            })
            .strict(),
        ),
        applications: z.array(id),
        marketSize: z.array(id),
        alternatives: z.array(id),
        economics: z.array(id),
        timing: z.array(id),
        keyQuestion: id,
      })
      .strict(),
    projects: z.array(
      z
        .object({
          projectId: id,
          candidateIds: z.array(id),
          role: z.enum(["supports", "contradicts", "context"]),
          contributionClaimId: id,
          independence: z.enum(["confirmed", "shared-origin", "unknown"]),
          originGroupId: id.nullable(),
        })
        .strict(),
    ),
    claims: z.array(opportunityClaimSchema),
    evidence: z.array(opportunityEvidenceSchema),
    assessment: z
      .object({
        rubricVersion: z.enum([
          "venture-screen-v1",
          "venture-screen-v2",
          "venture-screen-v3",
        ]),
        dimensions: z.record(z.enum(dimensions), judgment),
        priority: z.enum(["high", "medium", "low", "insufficient-information"]),
        priorityReason: id,
        confidence: z.object({ level: confidence, reason: id }).strict(),
        strongestObjection: z.string(),
        decisiveQuestion: id,
      })
      .strict(),
    migrationGaps: z
      .array(
        z
          .object({ field: id, reason: id, originalValue: z.unknown() })
          .strict(),
      )
      .default([]),
  })
  .strict();
export const opportunitySchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    revision: z.number().int().nonnegative(),
    acceptedRevisionId: id,
    maturity: z.enum(["first-impressions", "exploring"]),
    qualificationReviewId: id.nullable(),
    disposition: z.enum(["active", "held", "dismissed"]),
    dispositionReason: z.string().nullable(),
    researchEnabled: z.boolean().default(false),
    currentResearchId: id.nullable(),
    createdAt: time,
    updatedAt: time,
  })
  .strict();
export const lifecycleJobSchema = z
  .object({
    id,
    opportunityId: id,
    baseRevisionId: id,
    trigger: z.enum(["interested", "explicit-research", "explicit-retry"]),
    actor: z.enum(["operator", "test"]),
    requestIds: z.array(id),
    inputHash: hash.nullable(),
    outputHash: hash.nullable().default(null),
    scope: z.array(id),
    inputNotes: z.array(
      z
        .object({
          feedbackId: id,
          noteRevision: z.number().int().nonnegative(),
          text: z.string(),
        })
        .strict(),
    ),
    status: z.enum([
      "queued",
      "running",
      "pausing",
      "paused",
      "checking-sources",
      "awaiting-inspection",
      "completed",
      "failed",
      "cancelled",
    ]),
    cancelRequested: z.boolean(),
    ownerId: z.string().nullable(),
    draftRevisionId: id.nullable(),
    failureIds: z.array(id),
    reviewId: id.nullable(),
    requestedAt: time,
    startedAt: time.nullable(),
    finishedAt: time.nullable(),
  })
  .strict();
export type OpportunityRevision = z.infer<typeof opportunityRevisionSchema>;
export const researchStatusLabels = {
  queued: "Queued",
  running: "Research in progress",
  pausing: "Pausing",
  paused: "Paused",
  "checking-sources": "Checking sources",
  "awaiting-inspection": "Awaiting evidence review",
  completed: "Research finished",
  failed: "Research failed",
  cancelled: "Research cancelled",
};

// Public projection returned by the private lifecycle endpoint. Unknown fields
// are stripped; the UI never needs artifact paths or the mutable state store.
export const lifecycleViewSchema = z.object({
  version: z.literal(1),
  opportunities: z.array(
    opportunitySchema.extend({
      stage: z.enum(["first-impressions", "researching", "exploring"]),
      verdict: z
        .enum(["interested", "not-interested", "unsure"])
        .nullable()
        .default(null),
      qualificationError: z.string().nullable(),
      accepted: opportunityRevisionSchema,
      research: lifecycleJobSchema.nullable(),
      failures: z.array(z.object({ id, reason: id, at: time })),
      draft: opportunityRevisionSchema.nullable(),
    }),
  ),
});
export type OpportunityView = z.infer<
  typeof lifecycleViewSchema
>["opportunities"][number];
export const stageLabels = {
  "first-impressions": "Lead",
  researching: "Researching",
  exploring: "Exploring",
} satisfies Record<OpportunityView["stage"], string>;
