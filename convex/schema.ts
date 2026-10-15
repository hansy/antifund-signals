import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({
  demoPreferences: defineTable({
    actor: v.union(v.literal("operator"), v.literal("test")),
    cardId: v.string(),
    verdict: v.union(
      v.literal("interested"),
      v.literal("not-interested"),
      v.literal("unsure"),
      v.null(),
    ),
    version: v.number(),
  }).index("by_actor_card", ["actor", "cardId"]),
  demoPreferenceRequests: defineTable({
    actor: v.union(v.literal("operator"), v.literal("test")),
    requestId: v.string(),
    payload: v.string(),
  }).index("by_request", ["actor", "requestId"]),
  demoVoice: defineTable({
    actor: v.union(v.literal("operator"), v.literal("test")),
    segmentId: v.string(),
    cardId: v.string(),
    reviewer: v.string(),
    digest: v.string(),
    text: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("settled"),
      v.literal("failed"),
    ),
    token: v.string(),
    startedAt: v.number(),
  }).index("by_actor_segment", ["actor", "segmentId"]),
  demoVoiceQuota: defineTable({ day: v.string(), calls: v.number() }).index(
    "by_day",
    ["day"],
  ),
  signalNotes: defineTable({
    id: v.string(),
    cardId: v.string(),
    actor: v.union(v.literal("operator"), v.literal("test")),
    reviewer: v.string(),
    sessionId: v.string(),
    text: v.string(),
    segmentIds: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    version: v.number(),
    deleted: v.boolean(),
  })
    .index("by_signal", ["actor", "cardId"])
    .index("by_identity", ["actor", "id"]),
  signalNoteChanges: defineTable({
    actor: v.union(v.literal("operator"), v.literal("test")),
    requestId: v.string(),
    noteId: v.string(),
    payload: v.string(),
    previousText: v.union(v.string(), v.null()),
    createdAt: v.string(),
  }).index("by_request", ["actor", "requestId"]),
});
