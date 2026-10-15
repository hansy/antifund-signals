import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { signalNoteSchema, type NoteCommand } from "../lib/signal-notes";
export function convexNotes(settings: {
  CONVEX_URL?: string;
  RESEARCH_WRITE_SECRET?: string;
}) {
  const { CONVEX_URL, RESEARCH_WRITE_SECRET } = settings;
  if (!CONVEX_URL || !RESEARCH_WRITE_SECRET)
    throw Error("Notes storage is not configured.");
  const client = new ConvexHttpClient(CONVEX_URL);
  return {
    async list(actor: "operator" | "test", cardId?: string) {
      return signalNoteSchema.array().parse(
        await client.query(api.notes.list, {
          secret: RESEARCH_WRITE_SECRET,
          actor,
          ...(cardId ? { cardId } : {}),
        }),
      );
    },
    async write(command: NoteCommand) {
      await client.mutation(api.notes.write, {
        secret: RESEARCH_WRITE_SECRET,
        command: JSON.stringify(command),
      });
    },
  };
}
