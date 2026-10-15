import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import corpus from "../data/corpus.json";
import { requireSecret } from "./security";
import { noteCommandSchema, signalNoteSchema } from "../src/lib/signal-notes";
const actor = v.union(v.literal("operator"), v.literal("test"));
export const list = query({
  args: { secret: v.string(), actor, cardId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    const rows = await ctx.db
      .query("signalNotes")
      .withIndex("by_signal", (q) =>
        args.cardId === undefined
          ? q.eq("actor", args.actor)
          : q.eq("actor", args.actor).eq("cardId", args.cardId),
      )
      .collect();
    return rows
      .map(({ _id, _creationTime, ...note }) => note)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
});
export const write = mutation({
  args: { secret: v.string(), command: v.string() },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    const parsed = noteCommandSchema.safeParse(JSON.parse(args.command));
    if (!parsed.success) throw new ConvexError("Invalid note.");
    const command = parsed.data;
    const payload = JSON.stringify(command);
    const receipt = await ctx.db
      .query("signalNoteChanges")
      .withIndex("by_request", (q) =>
        q.eq("actor", command.actor).eq("requestId", command.requestId),
      )
      .unique();
    if (receipt) {
      if (receipt.payload !== payload)
        throw new ConvexError(
          "This request was already used for another change.",
        );
      return;
    }
    const existing = await ctx.db
      .query("signalNotes")
      .withIndex("by_identity", (q) =>
        q.eq("actor", command.actor).eq("id", command.id),
      )
      .unique();
    const now = new Date().toISOString();
    if (command.type === "create") {
      if (existing)
        throw new ConvexError(
          "This note is already saved. Refresh before adding another.",
        );
      // Read the actor's notes inside this mutation: concurrent creates conflict
      // and retry against committed claims, including soft-deleted notes.
      if (command.segmentIds.length) {
        const claimed = await ctx.db
          .query("signalNotes")
          .withIndex("by_signal", (q) => q.eq("actor", command.actor))
          .collect();
        if (
          claimed.some((n) =>
            n.segmentIds.some((id) => command.segmentIds.includes(id)),
          )
        )
          throw new ConvexError(
            "This recording already belongs to a saved note. Refresh your notes before saving.",
          );
      }
      await ctx.db.insert("signalNotes", {
        id: command.id,
        actor: command.actor,
        cardId: command.cardId,
        reviewer: command.reviewer,
        sessionId: command.sessionId,
        text: command.text,
        segmentIds: [...new Set(command.segmentIds)],
        createdAt: now,
        updatedAt: now,
        version: 1,
        deleted: false,
      });
    } else {
      if (!existing || existing.cardId !== command.cardId)
        throw new ConvexError("Note not found.");
      if (existing.version !== command.expectedVersion)
        throw new ConvexError(
          "This note changed in another window. Reload it before saving.",
        );
      if (command.type === "edit" && existing.deleted)
        throw new ConvexError("This note was deleted.");
      await ctx.db.patch(existing._id, {
        ...(command.type === "edit"
          ? { text: command.text }
          : { deleted: command.type === "delete" }),
        version: existing.version + 1,
        updatedAt: now,
      });
    }
    await ctx.db.insert("signalNoteChanges", {
      actor: command.actor,
      requestId: command.requestId,
      noteId: command.id,
      payload,
      previousText: existing?.text ?? null,
      createdAt: now,
    });
  },
});
