import { toast } from "sonner";
import { MicrophoneIcon, StopIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import type { Transcript } from "../lib/demo-feedback";

export type VoiceResult = {
  cardId: string;
  segmentId: string;
  text: string;
  status: "settled" | "failed";
  error?: string;
};
type Segment = {
  cardId: string;
  segmentId: string;
  visitId: string;
  blob: Blob;
  sessionId: string;
  actor: "operator" | "test";
  reviewer: string;
  endpoint?: string;
};
type Recording = {
  recorder: MediaRecorder;
  chunks: Blob[];
  cardId: string;
  segmentId: string;
  visitId: string;
  spoken: boolean;
  lastSpeech: number;
  started: number;
  departing: boolean;
};

async function audioStore<T>(
  action: (store: IDBObjectStore) => IDBRequest<T>,
  mode: IDBTransactionMode = "readonly",
): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("fieldwork-voice-v1", 1);
    open.onupgradeneeded = () =>
      open.result.createObjectStore("segments", { keyPath: "segmentId" });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result,
        tx = db.transaction("segments", mode),
        request = action(tx.objectStore("segments"));
      let result: T;
      request.onsuccess = () => {
        result = request.result;
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

export function useTrainingVoice({
  cardId,
  sessionId,
  onTranscript,
  receipts,
  endpoint = "/api/feedback",
}: {
  endpoint?: string;
  cardId: string | null;
  sessionId: string;
  receipts?: Record<string, Transcript>;
  onTranscript: (result: VoiceResult) => void;
}) {
  const [levels, setLevels] = useState<number[]>(() => Array(18).fill(0));
  const [restoring, setRestoring] = useState(true);
  const [available, setAvailable] = useState(false),
    [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("off"),
    [error, setError] = useState<string | null>(null);
  const callback = useRef(onTranscript),
    currentCard = useRef(cardId),
    currentSession = useRef(sessionId);
  callback.current = onTranscript;
  currentCard.current = cardId;
  currentSession.current = sessionId;
  const captureGeneration = useRef(0);
  const alive = useRef(true),
    enabledRef = useRef(false),
    stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null),
    active = useRef<Recording | null>(null);
  const meter = useRef<ReturnType<typeof setInterval> | null>(null),
    waitingForCard = useRef(false);
  const visitId = useRef("");
  const segments = useRef(
    new Map<
      string,
      {
        cardId: string;
        visitId: string;
        status: "pending" | "settled" | "failed";
      }
    >(),
  );
  const uploadQueue = useRef(Promise.resolve()),
    pending = useRef(0);
  const failed = useRef(new Map<string, Segment>());

  function enqueue(segment: Segment, save = true) {
    pending.current++;
    segments.current.set(segment.segmentId, {
      cardId: segment.cardId,
      visitId: segment.visitId,
      status: "pending",
    });
    if (alive.current) setStatus("transcribing");
    // Save now; a slow earlier upload must not hold later audio only in memory.
    const durable = save
      ? audioStore((s) => s.put(segment), "readwrite").then(
          () => null,
          (error) => error,
        )
      : Promise.resolve(null);
    uploadQueue.current = uploadQueue.current.then(async () => {
      try {
        const persistenceError = await durable;
        if (persistenceError) throw persistenceError;
        const response = await fetch(`${endpoint}/voice`, {
          method: "POST",
          headers: {
            "Content-Type": segment.blob.type || "audio/webm",
            "X-Training-Card": segment.cardId,
            "X-Training-Segment": segment.segmentId,
            "X-Training-Session": segment.sessionId,
            "X-Training-Actor": segment.actor,
            "X-Training-Reviewer": segment.reviewer,
          },
          body: segment.blob,
        });
        const data: { text?: string; error?: string } = await response.json();
        if (!response.ok || typeof data.text !== "string")
          throw Error(data.error ?? "Transcription failed.");
        segments.current.set(segment.segmentId, {
          cardId: segment.cardId,
          visitId: segment.visitId,
          status: "settled",
        });
        // The server has durably attached this receipt, including when the UI has moved on.
        await audioStore((s) => s.delete(segment.segmentId), "readwrite");
        failed.current.delete(segment.segmentId);
        if (alive.current)
          callback.current({
            cardId: segment.cardId,
            segmentId: segment.segmentId,
            text: data.text,
            status: "settled",
          });
      } catch (e) {
        failed.current.set(segment.segmentId, segment);
        segments.current.set(segment.segmentId, {
          cardId: segment.cardId,
          visitId: segment.visitId,
          status: "failed",
        });
        const message =
          e instanceof Error
            ? e.message
            : "Transcription failed. Your recording is saved for retry.";
        if (alive.current) {
          setError(message);
          callback.current({
            cardId: segment.cardId,
            segmentId: segment.segmentId,
            text: "",
            status: "failed",
            error: message,
          });
        }
      } finally {
        pending.current--;
        if (alive.current)
          setStatus(
            pending.current
              ? "transcribing"
              : enabledRef.current
                ? "listening"
                : "off",
          );
      }
    });
  }

  function begin() {
    if (
      !enabledRef.current ||
      !stream.current ||
      !currentCard.current ||
      active.current ||
      waitingForCard.current
    )
      return;
    const mime = ["audio/webm;codecs=opus", "audio/mp4"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    const recorder = new MediaRecorder(
      stream.current,
      mime ? { mimeType: mime } : undefined,
    );
    const recording: Recording = {
      recorder,
      chunks: [],
      cardId: currentCard.current,
      segmentId: crypto.randomUUID(),
      visitId: visitId.current,
      spoken: false,
      lastSpeech: 0,
      started: performance.now(),
      departing: false,
    };
    const ownerSession = currentSession.current;
    const actor =
      new URLSearchParams(location.search).get("actor") === "test"
        ? "test"
        : "operator";
    active.current = recording;
    recorder.ondataavailable = (event) => {
      if (event.data.size) recording.chunks.push(event.data);
    };
    recorder.onerror = () => {
      if (alive.current)
        setError(
          "Microphone recording failed. Type a note or enable it again.",
        );
      stop();
    };
    recorder.onstop = () => {
      if (active.current === recording) active.current = null;
      if (recording.spoken) {
        enqueue({
          endpoint,
          cardId: recording.cardId,
          segmentId: recording.segmentId,
          visitId: recording.visitId,
          sessionId: ownerSession,
          actor,
          reviewer: actor === "test" ? "ui-test" : "operator",
          blob: new Blob(recording.chunks, { type: recorder.mimeType }),
        });
      }
      begin();
    };
    recorder.start();
  }

  function finish() {
    const recording = active.current;
    if (recording?.recorder.state === "recording") recording.recorder.stop();
  }
  function stop() {
    captureGeneration.current++;
    enabledRef.current = false;
    finish();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (meter.current) clearInterval(meter.current);
    meter.current = null;
    void audio.current?.close();
    audio.current = null;
    if (alive.current) {
      setEnabled(false);
      setLevels(Array(18).fill(0));
      setStatus(pending.current ? "transcribing" : "off");
    }
  }
  async function toggle() {
    if (enabledRef.current || status === "starting") return stop();
    const generation = ++captureGeneration.current;
    setError(null);
    setStatus("starting");
    try {
      const input = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (
        !alive.current ||
        document.hidden ||
        generation !== captureGeneration.current
      ) {
        input.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = input;
      const context = new AudioContext();
      audio.current = context;
      await context.resume();
      if (!alive.current || generation !== captureGeneration.current) {
        input.getTracks().forEach((track) => track.stop());
        if (context.state !== "closed") await context.close();
        return;
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(input).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      enabledRef.current = true;
      setEnabled(true);
      setStatus("listening");
      begin();
      meter.current = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        const level = Math.sqrt(
          samples.reduce((sum, v) => sum + v * v, 0) / samples.length,
        );
        setLevels((history) => [...history.slice(1), Math.min(1, level * 12)]);
        const recording = active.current,
          now = performance.now();
        if (!recording) return begin();
        if (level > 0.012) {
          recording.spoken = true;
          recording.lastSpeech = now;
          segments.current.set(recording.segmentId, {
            cardId: recording.cardId,
            visitId: recording.visitId,
            status: "pending",
          });
        }
        if (
          (recording.spoken && now - recording.lastSpeech > 750) ||
          now - recording.started > 30_000
        )
          finish();
      }, 100);
    } catch (e) {
      stop();
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone access was denied. Allow it in your browser, or type your note."
          : "The microphone could not start in this browser. Typed notes still work.",
      );
    }
  }

  function retry() {
    setError(null);
    for (const segment of failed.current.values()) enqueue(segment, true);
    failed.current.clear();
  }
  useEffect(() => {
    alive.current = true;
    const actor =
      new URLSearchParams(location.search).get("actor") === "test"
        ? "test"
        : "operator";
    const reviewer = actor === "test" ? "ui-test" : "operator";
    void fetch(`${endpoint}/voice/status`)
      .then((r) => r.json())
      .then((value: { available: boolean }) => {
        if (alive.current)
          setAvailable(
            value.available &&
              !!navigator.mediaDevices?.getUserMedia &&
              typeof MediaRecorder !== "undefined",
          );
      })
      .catch(() => {});
    // Recover unfinished uploads after reload; server receipts make retries idempotent.
    void audioStore((s) => s.getAll())
      .then((values: Segment[]) => {
        for (const value of values)
          if (
            value.actor === actor &&
            value.reviewer === reviewer &&
            (value.endpoint ?? "/api/feedback") === endpoint
          )
            enqueue(value, false);
      })
      .catch(() => {
        if (alive.current)
          setError("Voice draft storage is unavailable. Use typed notes.");
      })
      .finally(() => {
        if (alive.current) setRestoring(false);
      });
    const hidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", hidden);
      stop();
    };
  }, []);
  useEffect(() => {
    const actor =
      new URLSearchParams(location.search).get("actor") === "test"
        ? "test"
        : "operator";
    const reviewer = actor === "test" ? "ui-test" : "operator";
    for (const receipt of Object.values(receipts ?? {}))
      if (receipt.actor === actor && receipt.reviewer === reviewer)
        segments.current.set(receipt.segmentId, {
          cardId: receipt.cardId,
          visitId: "restored",
          status: receipt.status,
        });
  }, [receipts]);
  useEffect(() => {
    visitId.current = crypto.randomUUID();
    waitingForCard.current = false;
    const recording = active.current;
    if (recording && recording.cardId !== cardId && !recording.departing)
      finish();
    else begin();
    if (!cardId) stop();
  }, [cardId]);
  return {
    available,
    levels,
    stop,
    enabled,
    status,
    error,
    toggle,
    retry,
    restoring,
  };
}

export function TrainingVoiceControl({
  voice,
  compact = false,
  embedded = false,
}: {
  voice: ReturnType<typeof useTrainingVoice>;
  compact?: boolean;
  embedded?: boolean;
}) {
  useEffect(() => {
    if (!embedded || !voice.error) return;
    const toastId = "voice-note-error";
    toast.error(voice.error, {
      id: toastId,
      duration: Infinity,
      action: { label: "Retry", onClick: () => voice.retry() },
    });
    return () => {
      toast.dismiss(toastId);
    };
  }, [embedded, voice.error]);
  const capturing = voice.enabled || voice.status === "starting";
  const dictating = capturing || voice.status === "transcribing";
  const label = embedded
    ? capturing
      ? "Stop dictation"
      : "Start dictation"
    : voice.status === "starting"
      ? "Cancel microphone"
      : voice.enabled
        ? "Turn microphone off"
        : "Turn microphone on";
  return (
    <div className={`training-voice${embedded ? " is-embedded" : ""}`}>
      <button
        type="button"
        title={label}
        onClick={() => {
          if (capturing) voice.stop();
          else void voice.toggle();
        }}
        disabled={!voice.available && !capturing}
        aria-pressed={capturing}
        aria-label={label}
        className={embedded && capturing ? "voice-stop-button" : undefined}
      >
        {embedded && capturing ? (
          <StopIcon width={18} height={18} aria-hidden="true" />
        ) : (
          <span className="voice-microphone-icon" aria-hidden="true">
            <MicrophoneIcon width={20} height={20} />
            {compact && !embedded && !voice.enabled && (
              <svg
                className="voice-mute-slash"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M3 3 21 21" />
              </svg>
            )}
          </span>
        )}
        {!compact &&
          (voice.status === "starting"
            ? "Cancel microphone"
            : voice.enabled
              ? "Mic on"
              : "Mic off")}
      </button>
      {embedded && dictating && (
        <div
          className={`voice-dictation${!voice.enabled && voice.status === "transcribing" ? " is-processing" : ""}`}
          aria-hidden="true"
        >
          <span className="voice-waveform">
            {voice.levels.map((level, index) => (
              <i
                key={index}
                style={{
                  height: `${3 + level * 19}px`,
                  animationDelay: `${index * 55}ms`,
                }}
              />
            ))}
          </span>
          <span>
            {voice.status === "starting"
              ? "Connecting…"
              : voice.enabled
                ? "Listening…"
                : "Transcribing…"}
          </span>
        </div>
      )}
      <span role="status" className={embedded ? "sr-only" : undefined}>
        {voice.status === "starting"
          ? "Allow microphone access in your browser."
          : voice.status === "finishing"
            ? "Finishing previous note…"
            : voice.status === "transcribing"
              ? "Transcribing…"
              : voice.enabled
                ? "Listening"
                : !voice.available
                  ? "Voice unavailable"
                  : ""}
      </span>
      {voice.error && !embedded && (
        <span role="alert">
          {voice.error}{" "}
          <button type="button" onClick={voice.retry}>
            Retry voice note
          </button>
        </span>
      )}
    </div>
  );
}
