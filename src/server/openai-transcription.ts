// Server-only: callers supply the key from server env/Worker secrets.
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

function audioType(bytes: Uint8Array) {
  const starts = (offset: number, text: string) =>
    [...text].every((char, i) => bytes[offset + i] === char.charCodeAt(0));
  if (starts(0, "RIFF") && starts(8, "WAVE"))
    return { name: "note.wav", type: "audio/wav" };
  if ([0x1a, 0x45, 0xdf, 0xa3].every((byte, i) => bytes[i] === byte))
    return { name: "note.webm", type: "audio/webm" };
  if (starts(4, "ftyp")) return { name: "note.mp4", type: "audio/mp4" };
  throw Error("This recording format is not supported.");
}

export async function transcribeOpenAI(
  bytes: Uint8Array,
  options: {
    apiKey?: string;
    fetcher?: (url: string, init: RequestInit) => Promise<Response>;
  },
): Promise<string> {
  if (!options.apiKey?.trim())
    throw Error("OpenAI transcription is not configured.");
  if (bytes.length < 32) throw Error("No audio was received.");
  if (bytes.length > MAX_AUDIO_BYTES) throw Error("Recording is too long.");
  const format = audioType(bytes);
  const body = new FormData();
  body.set(
    "file",
    new Blob([new Uint8Array(bytes)], { type: format.type }),
    format.name,
  );
  body.set("model", "gpt-4o-mini-transcribe");
  body.set("response_format", "json");
  body.set("language", "en");
  const response = await (options.fetcher ?? fetch)(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${options.apiKey.trim()}` },
      body,
      signal: AbortSignal.timeout(90_000),
      // Workers supports manual redirects; never forward credentials elsewhere.
      redirect: "manual",
    },
  );
  // Never propagate provider bodies, which may contain account or recording details.
  if (!response.ok)
    throw Error(`Transcription service failed (${response.status}).`);
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("text" in result) ||
    typeof result.text !== "string"
  )
    throw Error("Transcription service returned an invalid response.");
  return result.text.trim();
}
