import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireSecret } from "./security";
import { preferenceCommandSchema } from "../src/lib/demo-feedback";
import corpus from "../data/corpus.json";
const actor = v.union(v.literal("operator"), v.literal("test"));
function checkCard(id: string) {
  if (!corpus.insights.some((i) => i.id === id))
    throw new ConvexError("Unknown signal.");
}
export const feedback = query({
  args: { secret: v.string(), actor },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    const preferences = await ctx.db
      .query("demoPreferences")
      .withIndex("by_actor_card", (q) => q.eq("actor", args.actor))
      .collect();
    const voice = await ctx.db
      .query("demoVoice")
      .withIndex("by_actor_segment", (q) => q.eq("actor", args.actor))
      .collect();
    return {
      preferences: preferences.map(({ cardId, verdict, version }) => ({
        cardId,
        verdict,
        version,
      })),
      transcripts: Object.fromEntries(
        voice
          .filter((x) => x.status === "settled")
          .map((x) => [
            x.segmentId,
            {
              actor: x.actor,
              segmentId: x.segmentId,
              cardId: x.cardId,
              reviewer: x.reviewer,
              text: x.text,
              status: "settled",
            },
          ]),
      ),
    };
  },
});
export const prefer = mutation({
  args: { secret: v.string(), command: v.string() },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    const c = preferenceCommandSchema.parse(JSON.parse(args.command));
    checkCard(c.cardId);
    const previous = await ctx.db
      .query("demoPreferenceRequests")
      .withIndex("by_request", (q) =>
        q.eq("actor", c.actor).eq("requestId", c.requestId),
      )
      .unique();
    if (previous) {
      if (previous.payload !== JSON.stringify(c))
        throw new ConvexError("Request already used.");
      return;
    }
    const row = await ctx.db
      .query("demoPreferences")
      .withIndex("by_actor_card", (q) =>
        q.eq("actor", c.actor).eq("cardId", c.cardId),
      )
      .unique();
    if ((row?.version ?? 0) !== c.expectedVersion)
      throw new ConvexError("Preference changed. Refresh and try again.");
    const data = {
      actor: c.actor,
      cardId: c.cardId,
      verdict: c.verdict,
      version: (row?.version ?? 0) + 1,
    };
    if (row) await ctx.db.replace(row._id, data);
    else await ctx.db.insert("demoPreferences", data);
    await ctx.db.insert("demoPreferenceRequests", {
      actor: c.actor,
      requestId: c.requestId,
      payload: JSON.stringify(c),
    });
  },
});
// A global daily cap bounds costs for this anonymous demo. Claims also prevent
// duplicate provider calls when a recording is retried or two tabs upload it.
export const claimVoice = mutation({
  args: {
    secret: v.string(),
    actor,
    segmentId: v.string(),
    cardId: v.string(),
    reviewer: v.string(),
    digest: v.string(),
  },
  handler: async (ctx, a) => {
    requireSecret(a.secret);
    checkCard(a.cardId);
    if (a.segmentId.length > 150 || a.reviewer.length > 100)
      throw new ConvexError("Invalid recording.");
    const row = await ctx.db
      .query("demoVoice")
      .withIndex("by_actor_segment", (q) =>
        q.eq("actor", a.actor).eq("segmentId", a.segmentId),
      )
      .unique();
    if (
      row &&
      (row.cardId !== a.cardId ||
        row.digest !== a.digest ||
        row.reviewer !== a.reviewer)
    )
      throw new ConvexError("Recording identity changed.");
    if (row?.status === "settled") return { text: row.text, token: null };
    if (row?.status === "pending" && row.startedAt > Date.now() - 120_000)
      throw new ConvexError(
        "This recording is still transcribing. Retry shortly.",
      );
    const day = new Date().toISOString().slice(0, 10);
    const quota = await ctx.db
      .query("demoVoiceQuota")
      .withIndex("by_day", (q) => q.eq("day", day))
      .unique();
    if ((quota?.calls ?? 0) >= 50)
      throw new ConvexError(
        "Today's demo voice limit is reached. You can still type notes.",
      );
    if (quota) await ctx.db.patch(quota._id, { calls: quota.calls + 1 });
    else await ctx.db.insert("demoVoiceQuota", { day, calls: 1 });
    const token = crypto.randomUUID();
    const data = {
      actor: a.actor,
      segmentId: a.segmentId,
      cardId: a.cardId,
      reviewer: a.reviewer,
      digest: a.digest,
      text: "",
      status: "pending" as const,
      token,
      startedAt: Date.now(),
    };
    if (row) await ctx.db.replace(row._id, data);
    else await ctx.db.insert("demoVoice", data);
    return { text: null, token };
  },
});
export const finishVoice = mutation({
  args: {
    secret: v.string(),
    actor,
    segmentId: v.string(),
    token: v.string(),
    text: v.union(v.string(), v.null()),
  },
  handler: async (ctx, a) => {
    requireSecret(a.secret);
    const row = await ctx.db
      .query("demoVoice")
      .withIndex("by_actor_segment", (q) =>
        q.eq("actor", a.actor).eq("segmentId", a.segmentId),
      )
      .unique();
    if (!row || row.token !== a.token)
      throw new ConvexError("Recording changed. Retry shortly.");
    if ((a.text?.length ?? 0) > 12000)
      throw new ConvexError("Transcript is too long.");
    await ctx.db.patch(row._id, {
      text: a.text ?? "",
      status: a.text === null ? "failed" : "settled",
    });
  },
});
