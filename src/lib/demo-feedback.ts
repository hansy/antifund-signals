import { z } from "zod";
export const verdictSchema = z
  .enum(["interested", "not-interested", "unsure"])
  .nullable();
export const actorSchema = z.enum(["operator", "test"]);
export const preferenceSchema = z.object({
  cardId: z.string(),
  verdict: verdictSchema,
  version: z.number().int(),
});
export const transcriptSchema = z.object({
  actor: actorSchema,
  segmentId: z.string(),
  cardId: z.string(),
  text: z.string(),
  reviewer: z.string(),
  status: z.literal("settled"),
});
export type Transcript = z.infer<typeof transcriptSchema>;
export const feedbackSchema = z.object({
  preferences: z.array(preferenceSchema),
  transcripts: z.record(z.string(), transcriptSchema),
});
export type DemoFeedback = z.infer<typeof feedbackSchema>;
export const preferenceCommandSchema = z
  .object({
    actor: actorSchema,
    cardId: z.string().min(1).max(150),
    verdict: verdictSchema,
    expectedVersion: z.number().int().nonnegative(),
    requestId: z.string().min(1).max(150),
  })
  .strict();
