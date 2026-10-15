import { expect, test } from "bun:test";
import {
  MAX_AUDIO_BYTES,
  transcribeOpenAI,
} from "../src/server/openai-transcription";

function wav() {
  const data = new Uint8Array(44);
  data.set(new TextEncoder().encode("RIFF"));
  data.set(new TextEncoder().encode("WAVE"), 8);
  return data;
}

test("sends recording as multipart audio with server credential and returns only text", async () => {
  let calls = 0;
  const text = await transcribeOpenAI(wav(), {
    apiKey: "test-only-placeholder",
    fetcher: async (url, init) => {
      calls++;
      expect(init.redirect).toBe("manual");
      expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
      expect(new Headers(init.headers).get("Authorization")).toBe(
        "Bearer test-only-placeholder",
      );
      expect(init.signal).toBeInstanceOf(AbortSignal);
      const body = init.body as FormData;
      expect(body.get("model")).toBe("gpt-4o-mini-transcribe");
      expect(body.get("response_format")).toBe("json");
      const file = body.get("file") as File;
      expect(file.name).toBe("note.wav");
      expect(new Uint8Array(await file.arrayBuffer())).toEqual(wav());
      return Response.json({ text: "  Useful for small teams.  " });
    },
  });
  expect(text).toBe("Useful for small teams.");
  expect(calls).toBe(1);
});

test("missing key, unsupported audio and oversized recordings never call provider", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return Response.json({ text: "unused" });
  };
  await expect(transcribeOpenAI(wav(), { fetcher })).rejects.toThrow(
    "not configured",
  );
  await expect(
    transcribeOpenAI(new Uint8Array(40), { apiKey: "test", fetcher }),
  ).rejects.toThrow("format");
  await expect(
    transcribeOpenAI(new Uint8Array(MAX_AUDIO_BYTES + 1), {
      apiKey: "test",
      fetcher,
    }),
  ).rejects.toThrow("too long");
  expect(calls).toBe(0);
});

test("supports browser WebM and MP4 recordings", async () => {
  for (const [prefix, offset, name] of [
    [new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), 0, "note.webm"],
    [new TextEncoder().encode("ftyp"), 4, "note.mp4"],
  ] as const) {
    const bytes = new Uint8Array(40);
    bytes.set(prefix, offset);
    await transcribeOpenAI(bytes, {
      apiKey: "test",
      fetcher: async (_, init) => {
        expect(((init.body as FormData).get("file") as File).name).toBe(name);
        return Response.json({ text: "" });
      },
    });
  }
});

test("provider errors do not leak response bodies and malformed output is rejected", async () => {
  await expect(
    transcribeOpenAI(wav(), {
      apiKey: "test",
      fetcher: async () =>
        new Response("private account details", { status: 401 }),
    }),
  ).rejects.toThrow("Transcription service failed (401).");
  await expect(
    transcribeOpenAI(wav(), {
      apiKey: "test",
      fetcher: async () => Response.json({ text: 3 }),
    }),
  ).rejects.toThrow("invalid response");
});

test("redirects are rejected without following an authenticated request", async () => {
  let calls = 0;
  await expect(
    transcribeOpenAI(wav(), {
      apiKey: "test-only-placeholder",
      fetcher: async (_url, init) => {
        calls++;
        expect(init.redirect).toBe("manual");
        return new Response(null, {
          status: 302,
          headers: { Location: "https://elsewhere.example" },
        });
      },
    }),
  ).rejects.toThrow("Transcription service failed (302)");
  expect(calls).toBe(1);
});
