import { z } from "zod";
export const signalNoteSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  actor: z.enum(["operator", "test"]),
  reviewer: z.string(),
  sessionId: z.string(),
  text: z.string(),
  segmentIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int(),
  deleted: z.boolean(),
});
export type SignalNote = z.infer<typeof signalNoteSchema>;
const base = {
  actor: z.enum(["operator", "test"]),
  cardId: z.string().regex(/^[\w-]{1,150}$/),
  id: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
};
export const noteCommandSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...base,
      type: z.literal("create"),
      text: z.string().trim().min(1).max(12000),
      reviewer: z.string().min(1).max(100),
      sessionId: z.string().min(1).max(200),
      segmentIds: z.array(z.string().max(200)).max(100),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("edit"),
      text: z.string().trim().min(1).max(12000),
      expectedVersion: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("delete"),
      expectedVersion: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("restore"),
      expectedVersion: z.number().int().positive(),
    })
    .strict(),
]);
export type NoteCommand = z.infer<typeof noteCommandSchema>;
export const notesResponseSchema = z.object({
  notes: z.array(signalNoteSchema),
});
