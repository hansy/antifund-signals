/** Agent37 SSE transport. Disconnects reattach to the same response; never resend input. */
export async function readEvents(
  body: ReadableStream<Uint8Array>,
  receive: (name: string, data: Record<string, unknown>) => Promise<void>,
) {
  const reader = body.getReader(),
    decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      buffer += decoder.decode(part.value, { stream: true });
      if (buffer.length > 2_000_000) throw Error("Agent event exceeds limit");
      for (;;) {
        const match = /\r?\n\r?\n/.exec(buffer);
        if (!match) break;
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const lines = block.split(/\r?\n/),
          name = lines
            .find((l) => l.startsWith("event:"))
            ?.slice(6)
            .trim();
        const data = lines
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (name && data) await receive(name, JSON.parse(data));
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
