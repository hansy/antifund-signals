import { test, expect } from "bun:test";
import {
  appendDictation,
  finishNoteSave,
  newNoteDraft,
  restoreNoteDraft,
  loadNoteDraft,
} from "../src/lib/opportunity-notes";
test("draft dictation appends once, stays editable across reloads, and late dictation survives a save", () => {
  let draft = appendDictation(
    newNoteDraft("Typed first"),
    "one",
    "Spoken second",
  );
  expect(draft.text).toBe("Typed first\n\nSpoken second");
  draft = { ...draft, text: "Edited both" };
  draft = restoreNoteDraft(JSON.stringify(draft));
  expect(appendDictation(draft, "one", "Spoken second")).toBe(draft);
  const late = appendDictation(draft, "two", "Late words");
  const after = finishNoteSave(late, draft);
  expect(after.text).toBe("Late words");
  expect(after.segmentIds).toEqual(["two"]);
  expect(appendDictation(after, "one", "Spoken second")).toBe(after);
  expect(finishNoteSave({ ...draft, text: " Edited both " }, draft).text).toBe(
    "",
  );
});
test("unavailable or malformed browser storage still supplies an editable in-memory draft", () => {
  for (const read of [
    () => {
      throw Error("Storage denied");
    },
    () => "invalid JSON",
  ]) {
    const loaded = loadNoteDraft(read, "draft", "legacy");
    expect(loaded.error).not.toBe("");
    expect(loaded.draft.id.length).toBeGreaterThan(0);
    expect(appendDictation(loaded.draft, "receipt", "Editable note").text).toBe(
      "Editable note",
    );
  }
});

test("recovering a saved trimmed note keeps only dictation that arrived afterward", () => {
  const saved = newNoteDraft("Original");
  const current = appendDictation(
    { ...saved, text: "  Original  " },
    "late",
    "New dictation",
  );
  expect(finishNoteSave(current, saved).text).toBe("New dictation");
});
