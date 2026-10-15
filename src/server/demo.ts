import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import { preferenceCommandSchema } from "../lib/demo-feedback";
import { lifecycleViewSchema } from "../lib/opportunity-lifecycle";
import snapshot from "../../data/opportunities.json";
import corpus from "../../data/corpus.json";
import { transcribeOpenAI, MAX_AUDIO_BYTES } from "./openai-transcription";
export type DemoSettings = {
  CONVEX_URL?: string;
  RESEARCH_WRITE_SECRET?: string;
  OPENAI_API_KEY?: string;
};
export function demoClient(settings: DemoSettings) {
  if (!settings.CONVEX_URL || !settings.RESEARCH_WRITE_SECRET)
    throw Error("Storage is not configured.");
  return {
    client: new ConvexHttpClient(settings.CONVEX_URL),
    secret: settings.RESEARCH_WRITE_SECRET,
  };
}
export function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function failure(e: unknown) {
  return reply(
    {
      error:
        e instanceof ConvexError
          ? String(e.data)
          : "Could not reach storage. Please try again.",
    },
    e instanceof ConvexError ? 409 : 503,
  );
}
export async function readBytes(request: Request, limit: number) {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader)
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RangeError("Request is too large.");
      }
      chunks.push(part.value);
    }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of chunks) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
export async function feedback(request: Request, settings: DemoSettings) {
  const url = new URL(request.url);
  const actor = url.searchParams.get("actor") === "test" ? "test" : "operator";
  try {
    const { client, secret } = demoClient(settings);
    if (request.method === "POST") {
      if (request.headers.get("origin") !== url.origin)
        return reply({ error: "Request origin is not allowed." }, 403);
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return reply({ error: "Expected JSON." }, 415);
      const c = preferenceCommandSchema.safeParse(
        JSON.parse(new TextDecoder().decode(await readBytes(request, 4096))),
      );
      if (!c.success) return reply({ error: "Invalid preference." }, 400);
      await client.mutation(api.demo.prefer, {
        secret,
        command: JSON.stringify(c.data),
      });
      return reply(
        await client.query(api.demo.feedback, { secret, actor: c.data.actor }),
      );
    }
    return reply(await client.query(api.demo.feedback, { secret, actor }));
  } catch (e) {
    if (e instanceof SyntaxError) return reply({ error: "Invalid JSON." }, 400);
    if (e instanceof RangeError) return reply({ error: e.message }, 413);
    return failure(e);
  }
}
export async function stages(request: Request, settings: DemoSettings) {
  try {
    const { client, secret } = demoClient(settings);
    const actor =
      new URL(request.url).searchParams.get("actor") === "test"
        ? "test"
        : "operator";
    const saved = await client.query(api.demo.feedback, { secret, actor });
    const research = await client.query(api.research.list, { secret, actor });
    return reply(
      lifecycleViewSchema.parse({
        ...snapshot,
        opportunities: snapshot.opportunities.map((o) => {
          const job = research.jobs.find((j) => j.cardId === o.id);
          return {
            ...o,
            researchEnabled: research.enabled,
            stage: job ? "researching" : o.stage,
            currentResearchId: job?.id ?? null,
            research: job
              ? {
                  id: job.id,
                  opportunityId: o.id,
                  baseRevisionId: o.acceptedRevisionId,
                  trigger: "interested",
                  actor,
                  requestIds: [],
                  inputHash: null,
                  outputHash: null,
                  scope: job.completedSteps,
                  inputNotes: [],
                  status: job.status,
                  cancelRequested: false,
                  ownerId: null,
                  draftRevisionId: null,
                  failureIds: [],
                  reviewId: null,
                  requestedAt: job.createdAt,
                  startedAt: job.startedAt,
                  finishedAt: null,
                }
              : null,
            failures: job?.failure
              ? [{ id: job.id, reason: job.failure, at: job.updatedAt }]
              : [],
            verdict:
              saved.preferences.find((p) => p.cardId === o.id)?.verdict ?? null,
          };
        }),
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function voice(request: Request, settings: DemoSettings) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ error: "Request origin is not allowed." }, 403);
  if (!settings.OPENAI_API_KEY)
    return reply(
      { error: "Voice is unavailable. You can still type notes." },
      503,
    );
  const cardId = request.headers.get("X-Training-Card") ?? "",
    segmentId = request.headers.get("X-Training-Segment") ?? "";
  const actor =
    request.headers.get("X-Training-Actor") === "test" ? "test" : "operator";
  const reviewer = actor === "test" ? "ui-test" : "operator";
  if (
    !corpus.insights.some((i) => i.id === cardId) ||
    !/^[\w-]{1,150}$/.test(segmentId)
  )
    return reply({ error: "Invalid recording." }, 400);
  try {
    const bytes = await readBytes(request, MAX_AUDIO_BYTES);
    if (bytes.length < 32)
      return reply({ error: "No audio was received." }, 400);
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const { client, secret } = demoClient(settings);
    const claim = await client.mutation(api.demo.claimVoice, {
      secret,
      actor,
      segmentId,
      cardId,
      reviewer,
      digest,
    });
    if (claim.text !== null) return reply({ text: claim.text });
    try {
      const text = await transcribeOpenAI(bytes, {
        apiKey: settings.OPENAI_API_KEY,
      });
      await client.mutation(api.demo.finishVoice, {
        secret,
        actor,
        segmentId,
        token: claim.token!,
        text,
      });
      return reply({ text });
    } catch (error) {
      // Provider bodies and recordings are never logged. The transcription helper
      // exposes only a status code or a local validation error.
      console.error(
        "Voice request failed:",
        error instanceof Error ? error.message.slice(0, 200) : "Unknown error",
      );
      await client.mutation(api.demo.finishVoice, {
        secret,
        actor,
        segmentId,
        token: claim.token!,
        text: null,
      });
      return reply(
        { error: "Transcription failed. Retry or type your note." },
        503,
      );
    }
  } catch (e) {
    if (e instanceof RangeError) return reply({ error: e.message }, 413);
    return failure(e);
  }
}
