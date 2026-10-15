import { z } from "zod";

const draftSchema = z.object({
  id: z.string(),
  text: z.string(),
  segmentIds: z.array(z.string()),
  seenSegmentIds: z.array(z.string()),
});
export type NoteDraft = z.infer<typeof draftSchema>;
export function newNoteDraft(text = ""): NoteDraft {
  return { id: crypto.randomUUID(), text, segmentIds: [], seenSegmentIds: [] };
}
export function restoreNoteDraft(
  saved: string | null,
  legacyText = "",
): NoteDraft {
  if (saved === null) return newNoteDraft(legacyText);
  return draftSchema.parse(JSON.parse(saved));
}
export function loadNoteDraft(
  read: (key: string) => string | null,
  draftKey: string,
  legacyKey: string,
): { draft: NoteDraft; error: string } {
  try {
    return {
      draft: restoreNoteDraft(read(draftKey), read(legacyKey) ?? ""),
      error: "",
    };
  } catch {
    return {
      draft: newNoteDraft(),
      error:
        "Could not restore your draft. You can still write and save a new note.",
    };
  }
}
export function appendDictation(
  draft: NoteDraft,
  segmentId: string,
  text: string,
): NoteDraft {
  if (draft.seenSegmentIds.includes(segmentId)) return draft;
  return {
    ...draft,
    text: [draft.text, text.trim()].filter(Boolean).join("\n\n"),
    segmentIds: [...draft.segmentIds, segmentId],
    seenSegmentIds: [...draft.seenSegmentIds, segmentId],
  };
}
export function finishNoteSave(
  current: NoteDraft,
  saved: NoteDraft,
): NoteDraft {
  if (current.id !== saved.id) return current;
  // Dictation may arrive while the saved snapshot is in flight.
  const currentText = current.text.trimStart();
  const savedText = saved.text.trim();
  const remainder =
    currentText.trimEnd() === savedText
      ? ""
      : currentText.startsWith(savedText)
        ? currentText.slice(savedText.length).trimStart()
        : current.text;
  return {
    ...newNoteDraft(remainder),
    segmentIds: current.segmentIds.filter(
      (id) => !saved.segmentIds.includes(id),
    ),
    seenSegmentIds: current.seenSegmentIds,
  };
}
