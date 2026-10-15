import { ConvexError } from "convex/values";
import { noteCommandSchema } from "../lib/signal-notes";
import type { convexNotes } from "./notes-store";
export async function handleNotes(
  request: Request,
  store: ReturnType<typeof convexNotes>,
) {
  const url = new URL(request.url);
  const reply = (value: unknown, status = 200) =>
    Response.json(value, {
      status,
      headers: { "Cache-Control": "no-store, private" },
    });
  try {
    if (request.method === "GET") {
      const cardId = url.searchParams.get("cardId");
      if (!cardId || !/^[\w-]{1,150}$/.test(cardId))
        return reply({ error: "Signal is required." }, 400);
      return reply({
        notes: await store.list(
          url.searchParams.get("actor") === "test" ? "test" : "operator",
          cardId,
        ),
      });
    }
    if (request.method !== "POST")
      return reply({ error: "Method not allowed." }, 405);
    if (request.headers.get("origin") !== url.origin)
      return reply({ error: "Request origin is not allowed." }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return reply({ error: "Expected JSON." }, 415);
    const reader = request.body?.getReader();
    let text = "",
      size = 0;
    const decoder = new TextDecoder();
    if (reader)
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 64000) {
          await reader.cancel();
          return reply({ error: "Note is too large." }, 413);
        }
        text += decoder.decode(part.value, { stream: true });
      }
    text += decoder.decode();
    const parsed = noteCommandSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return reply({ error: "Invalid note." }, 400);
    await store.write(parsed.data);
    return reply({
      notes: await store.list(parsed.data.actor, parsed.data.cardId),
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return reply({ error: "Invalid JSON." }, 400);
    if (error instanceof ConvexError)
      return reply({ error: String(error.data) }, 409);
    return reply(
      { error: "Could not reach notes storage. Your draft is retained." },
      503,
    );
  }
}
