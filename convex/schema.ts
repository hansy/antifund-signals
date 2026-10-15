import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({
  researchWorker: defineTable({
    name: v.string(),
    owner: v.string(),
    expires: v.number(),
  }).index("by_name", ["name"]),
  researchJobs: defineTable({
    actor: v.union(v.literal("operator"), v.literal("test")),
    cardId: v.string(),
    desired: v.boolean(),
    // Explicit batch requests run independently of preference toggles.
    batchRequestedAt: v.optional(v.string()),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("pausing"),
      v.literal("paused"),
      v.literal("awaiting-inspection"),
      v.literal("failed"),
      v.literal("completed"),
    ),
    review: v.optional(
      v.object({
        id: v.string(),
        reviewedAt: v.string(),
        checkpointHashes: v.array(v.string()),
        auditArchiveId: v.id("_storage"),
        auditSha256: v.string(),
        publishedRevisionId: v.string(),
        publishedRevisionHash: v.string(),
      }),
    ),
    execution: v.string(),
    owner: v.string(),
    attempts: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
    startedAt: v.union(v.string(), v.null()),
    failure: v.union(v.string(), v.null()),
    steps: v.array(
      v.object({
        name: v.string(),
        report: v.string(),
        archiveId: v.id("_storage"),
        sha256: v.string(),
        completedAt: v.string(),
      }),
    ),
  }).index("by_actor_card", ["actor", "cardId"]),
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
