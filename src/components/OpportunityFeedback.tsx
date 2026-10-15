import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { IconTooltip } from "./ui/tooltip";
import { toast } from "sonner";
import {
  HandThumbUpIcon,
  HandThumbDownIcon,
  DocumentTextIcon,
  ArrowUpIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { feedbackSchema, type DemoFeedback } from "../lib/demo-feedback";
import { TrainingVoiceControl, useTrainingVoice } from "./TrainingVoice";
import "./opportunity-feedback.css";
import {
  appendDictation,
  finishNoteSave,
  newNoteDraft,
  loadNoteDraft,
  type NoteDraft,
} from "../lib/opportunity-notes";
import {
  notesResponseSchema,
  type NoteCommand,
  type SignalNote,
} from "../lib/signal-notes";
const endpoint = "/api/feedback";
export function OpportunityFeedback({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [data, setData] = useState<DemoFeedback | null>(null),
    [draft, setDraft] = useState<NoteDraft>(() => newNoteDraft()),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sessionId] = useState(() => crypto.randomUUID());
  const actor: "operator" | "test" =
    typeof window !== "undefined" &&
    new URLSearchParams(location.search).get("actor") === "test"
      ? "test"
      : "operator";
  const reviewer = actor === "test" ? "ui-test" : "operator";
  const noteQueryKey = ["signal-notes", actor, id];
  const notesQuery = useQuery({
    queryKey: noteQueryKey,
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/notes?actor=${actor}&cardId=${encodeURIComponent(id)}`,
        { signal },
      );
      const json = await response.json();
      if (!response.ok) throw Error(json.error ?? "Could not load notes.");
      return notesResponseSchema.parse(json);
    },
    refetchInterval: 5000,
  });
  const allNotes = notesQuery.data?.notes ?? [];
  const savedNotes = allNotes.filter((n) => !n.deleted);
  const [editing, setEditing] = useState<{
    note: SignalNote;
    text: string;
    requestId: string;
  } | null>(null);
  async function writeNote(command: NoteCommand) {
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    const json = await response.json();
    if (!response.ok) throw Error(json.error ?? "Could not save note.");
    const result = notesResponseSchema.parse(json);
    await queryClient.cancelQueries({ queryKey: noteQueryKey });
    queryClient.setQueryData(noteQueryKey, result);
    return result;
  }
  async function changeNote(command: NoteCommand) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    const submitted = draftRef.current;
    try {
      const result = await writeNote(command);
      if (command.type === "create" && draftRef.current.id === submitted.id) {
        storeDraft(finishNoteSave(draftRef.current, submitted));
        try {
          localStorage.removeItem(`opportunity-note:${actor}:${id}`);
        } catch {
          /* Server save is already durable. */
        }
      }
      if (command.type === "edit") setEditing(null);
      if (command.type === "delete") {
        const deleted = result.notes.find((n) => n.id === command.id)!;
        toast.success("Note deleted", {
          action: {
            label: "Undo",
            onClick: () => {
              void changeNote({
                type: "restore",
                actor,
                cardId: id,
                id: deleted.id,
                expectedVersion: deleted.version,
                requestId: crypto.randomUUID(),
              });
            },
          },
        });
      } else
        toast.success(
          command.type === "restore" ? "Note restored" : "Note saved",
        );
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save note.");
      void notesQuery.refetch();
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const saving = useRef(false),
    draftKey = `opportunity-note-draft:${actor}:${id}`;
  const draftRef = useRef(draft);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const note = draft.text;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [multiline, setMultiline] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  function storeDraft(next: NoteDraft) {
    draftRef.current = next;
    setDraft(next);
    try {
      localStorage.setItem(draftKey, JSON.stringify(next));
    } catch {
      setError(
        "Draft storage is unavailable. Keep this page open until your note is saved.",
      );
    }
  }
  async function read(response: Response) {
    const json = await response.json();
    if (!response.ok)
      throw Error(json.error ?? "Could not save. Your note is retained.");
    return feedbackSchema.parse(json);
  }
  async function refresh() {
    const result = await read(await fetch(`${endpoint}?actor=${actor}`));
    setData(result);
    return result;
  }
  const errorToastId = `feedback-error:${actor}:${id}`;
  function showError(message: string) {
    toast.error(message, {
      id: errorToastId,
      duration: Infinity,
      description: "Your note is retained.",
      action: {
        label: "Refresh",
        onClick: () => {
          void refresh()
            .then(() => {
              setError("");
              toast.dismiss(errorToastId);
              toast.success("Feedback refreshed", {
                id: `feedback-refreshed:${actor}:${id}`,
                duration: 3000,
              });
            })
            .catch((cause) =>
              showError(
                cause instanceof Error
                  ? cause.message
                  : "Could not refresh feedback.",
              ),
            );
        },
      },
    });
  }
  useEffect(() => {
    if (error) showError(error);
  }, [error]);
  useEffect(
    () => () => {
      toast.dismiss(errorToastId);
    },
    [errorToastId],
  );
  const voice = useTrainingVoice({
    cardId: id,
    sessionId,
    endpoint,
    receipts: data?.transcripts,
    onTranscript: () => {
      void refresh().catch((e) => setError(String(e)));
    },
  });
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const resize = () => {
      input.style.height = "44px";
      const expanded =
        input.scrollHeight > 44 ||
        note.includes("\n") ||
        voice.status === "transcribing" ||
        voice.enabled ||
        voice.status === "starting";
      setMultiline(expanded || inputFocused);
      input.style.height = `${expanded || inputFocused ? Math.min(180, Math.max(88, input.scrollHeight)) : 44}px`;
    };
    resize();
    let width = input.parentElement?.clientWidth;
    const observer = new ResizeObserver(() => {
      const nextWidth = input.parentElement?.clientWidth;
      if (nextWidth !== width) {
        width = nextWidth;
        resize();
      }
    });
    // Observe the container so height changes do not trigger a resize loop.
    if (input.parentElement) observer.observe(input.parentElement);
    return () => observer.disconnect();
  }, [note, mounted, voice.status, voice.enabled, inputFocused]);
  const decision = data?.preferences.find((p) => p.cardId === id);
  useEffect(() => {
    const loaded = loadNoteDraft(
      (key) => localStorage.getItem(key),
      draftKey,
      `opportunity-note:${actor}:${id}`,
    );
    draftRef.current = loaded.draft;
    setDraft(loaded.draft);
    setDraftLoaded(true);
    if (loaded.error) setError(loaded.error);
    let alive = true;
    const update = () => {
      if (!saving.current)
        void refresh().catch((e) => {
          if (alive) setError(e.message);
        });
    };
    update();
    const t = setInterval(update, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);
  useEffect(() => {
    if (!data || !draftLoaded || !notesQuery.data) return;
    const consumed = new Set([...allNotes.flatMap((n) => n.segmentIds)]);
    let next = draftRef.current;
    const saved = allNotes.find((n) => n.id === next.id);
    // A save may have succeeded even if its response was lost. Reconcile on
    // refresh so retrying or reopening the signal cannot duplicate the note.
    if (saved) {
      next = finishNoteSave(next, {
        ...next,
        text: saved.text,
        segmentIds: saved.segmentIds,
      });
    }
    for (const receipt of Object.values(data.transcripts)) {
      if (
        receipt.cardId !== id ||
        receipt.reviewer !== reviewer ||
        receipt.status !== "settled" ||
        consumed.has(receipt.segmentId)
      )
        continue;
      next = appendDictation(next, receipt.segmentId, receipt.text);
    }
    if (next !== draftRef.current) storeDraft(next);
  }, [data, notesQuery.data, draftLoaded, id, reviewer]);
  function edit(value: string) {
    storeDraft(
      value
        ? { ...draftRef.current, text: value }
        : {
            ...newNoteDraft(),
            seenSegmentIds: draftRef.current.seenSegmentIds,
          },
    );
  }
  async function toggleInterest(verdict: "interested" | "not-interested") {
    if (!data || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const next = decision?.verdict === verdict ? null : verdict;
      const result = await read(
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor,
            cardId: id,
            verdict: next,
            expectedVersion: decision?.version ?? 0,
            requestId: crypto.randomUUID(),
          }),
        }),
      );
      setData(result);
      toast.success(
        next === null
          ? "Preference cleared"
          : next === "interested"
            ? "Saved as interesting"
            : "Saved as not interesting",
      );
      void queryClient.invalidateQueries({
        queryKey: ["opportunity-stages", actor],
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save preference.",
      );
      await refresh().catch(() => {});
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="opportunity-feedback">
      {mounted &&
        createPortal(
          <div
            className="opportunity-feedback-dock"
            role="region"
            aria-label="Opportunity feedback"
          >
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="opportunity-notes-trigger"
                  aria-label={`Notes (${savedNotes.length})`}
                  title="View notes"
                >
                  <DocumentTextIcon width={20} height={20} aria-hidden="true" />
                  {savedNotes.length > 0 && (
                    <span className="opportunity-note-count">
                      {savedNotes.length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                sideOffset={16}
                collisionPadding={16}
                className="opportunity-note-history"
                aria-label="Saved notes"
              >
                <strong>Notes</strong>
                {notesQuery.isPending && <p>Loading notes…</p>}
                {notesQuery.isError && (
                  <p role="alert">
                    Could not load notes.{" "}
                    <button onClick={() => void notesQuery.refetch()}>
                      Retry
                    </button>
                  </p>
                )}
                {!notesQuery.isPending &&
                  !notesQuery.isError &&
                  savedNotes.length === 0 && <p>No notes yet.</p>}
                {savedNotes.map((n) => (
                  <div className="opportunity-note-entry" key={n.id}>
                    {editing?.note.id === n.id ? (
                      <>
                        <textarea
                          aria-label="Edit saved note"
                          className="opportunity-note-inline-editor"
                          rows={1}
                          autoFocus
                          ref={(element) => {
                            if (element) {
                              element.style.height = "auto";
                              element.style.height = `${element.scrollHeight}px`;
                            }
                          }}
                          value={editing.text}
                          maxLength={12000}
                          disabled={busy}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              text: e.target.value,
                              requestId: crypto.randomUUID(),
                            })
                          }
                        />
                        <div className="opportunity-note-tools">
                          <IconTooltip label="Save changes">
                            <button
                              type="button"
                              aria-label="Save changes"
                              disabled={busy || !editing.text.trim()}
                              onClick={() =>
                                void changeNote({
                                  type: "edit",
                                  actor,
                                  cardId: id,
                                  id: n.id,
                                  text: editing.text,
                                  expectedVersion: editing.note.version,
                                  requestId: editing.requestId,
                                })
                              }
                            >
                              <CheckIcon
                                width={17}
                                height={17}
                                aria-hidden="true"
                              />
                            </button>
                          </IconTooltip>
                          <IconTooltip label="Cancel editing">
                            <button
                              type="button"
                              aria-label="Cancel editing"
                              disabled={busy}
                              onClick={() => setEditing(null)}
                            >
                              <XMarkIcon
                                width={17}
                                height={17}
                                aria-hidden="true"
                              />
                            </button>
                          </IconTooltip>
                        </div>
                      </>
                    ) : (
                      <>
                        <p>{n.text}</p>
                        <div className="opportunity-note-tools">
                          <IconTooltip label="Edit note">
                            <button
                              type="button"
                              aria-label="Edit note"
                              disabled={busy}
                              onClick={() =>
                                setEditing({
                                  note: n,
                                  text: n.text,
                                  requestId: crypto.randomUUID(),
                                })
                              }
                            >
                              <PencilSquareIcon
                                width={17}
                                height={17}
                                aria-hidden="true"
                              />
                            </button>
                          </IconTooltip>
                          <IconTooltip label="Delete note">
                            <button
                              type="button"
                              aria-label="Delete note"
                              disabled={busy}
                              onClick={() =>
                                void changeNote({
                                  type: "delete",
                                  actor,
                                  cardId: id,
                                  id: n.id,
                                  expectedVersion: n.version,
                                  requestId: crypto.randomUUID(),
                                })
                              }
                            >
                              <TrashIcon
                                width={17}
                                height={17}
                                aria-hidden="true"
                              />
                            </button>
                          </IconTooltip>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </PopoverContent>
            </Popover>
            <label className="sr-only" htmlFor={"opportunity-note-" + id}>
              Notes <span>optional</span>
            </label>
            <div
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  setInputFocused(false);
              }}
              className={`opportunity-note-field${multiline ? " is-multiline" : ""}${note.trim() ? " has-draft" : ""}${voice.status === "transcribing" || voice.enabled || voice.status === "starting" ? " is-transcribing" : ""}`}
            >
              <textarea
                onFocus={() => setInputFocused(true)}
                onBlur={(event) => {
                  if (
                    !event.currentTarget.parentElement?.contains(
                      event.relatedTarget,
                    )
                  )
                    setInputFocused(false);
                }}
                ref={inputRef}
                id={"opportunity-note-" + id}
                rows={1}
                maxLength={12000}
                disabled={busy}
                value={note}
                onChange={(e) => edit(e.target.value)}
                placeholder="Add a note…"
                aria-busy={voice.status === "transcribing"}
              />
              <TrainingVoiceControl voice={voice} compact embedded />
              {note.trim() && (
                <button
                  className="opportunity-save-note"
                  type="button"
                  aria-label="Save note"
                  title="Save note"
                  disabled={
                    busy || !note.trim() || !draftLoaded || !notesQuery.data
                  }
                  onClick={() =>
                    void changeNote({
                      type: "create",
                      actor,
                      reviewer,
                      sessionId: draft.id,
                      requestId: `note:${draft.id}`,
                      id: draft.id,
                      cardId: id,
                      text: draft.text,
                      segmentIds: draft.segmentIds,
                    })
                  }
                >
                  <ArrowUpIcon width={18} height={18} aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="opportunity-feedback-actions">
              {(["interested", "not-interested"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={decision?.verdict === v}
                  aria-label={
                    v === "interested" ? "Interesting" : "Not interesting"
                  }
                  aria-describedby={
                    v === "interested" ? "opportunity-hint-" + id : undefined
                  }
                  title={
                    decision?.verdict === v
                      ? "Clear preference"
                      : v === "interested"
                        ? "Interesting"
                        : "Not interesting"
                  }
                  className="opportunity-decision-icon"
                  disabled={busy || !data}
                  onClick={() => toggleInterest(v)}
                >
                  {v === "interested" ? (
                    <HandThumbUpIcon
                      width={20}
                      height={20}
                      aria-hidden="true"
                    />
                  ) : (
                    <HandThumbDownIcon
                      width={20}
                      height={20}
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>
            <p
              className="opportunity-feedback-hint sr-only"
              id={"opportunity-hint-" + id}
            >
              {actor === "test"
                ? "Test mode: decisions are saved separately and research will not run."
                : "Save your preference. Research is disabled in this demo."}
            </p>
          </div>,
          document.body,
        )}
    </section>
  );
}
