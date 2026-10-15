import { test, expect } from "bun:test";
import { readEvents } from "../scripts/agent37-gateway";
test("split SSE frames, CRLF, keepalives and Unicode preserve response identity and terminal result", async () => {
  const text =
    ':keepalive\r\n\r\nevent: response.created\r\ndata: {"id":"one"}\r\n\r\nevent: response.completed\ndata: {"output_text":"€ evidence"}\n\n';
  const bytes = new TextEncoder().encode(text),
    result: unknown[] = [];
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const b of bytes) c.enqueue(new Uint8Array([b]));
      c.close();
    },
  });
  await readEvents(stream, async (name, data) => {
    result.push([name, data]);
  });
  expect(result).toEqual([
    ["response.created", { id: "one" }],
    ["response.completed", { output_text: "€ evidence" }],
  ]);
});
test("bad SSE JSON fails rather than inventing a finished report", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(
        new TextEncoder().encode("event: response.completed\ndata: broken\n\n"),
      );
      c.close();
    },
  });
  await expect(readEvents(stream, async () => {})).rejects.toThrow();
});

test("report reader rejects symlinks and oversized output", async () => {
  const { mkdtemp, writeFile, symlink, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { readReport } = await import("../scripts/research-files");
  const dir = await mkdtemp(join(tmpdir(), "signal-report-"));
  try {
    await writeFile(join(dir, "report.json"), '{"summary":"saved"}');
    expect(await readReport(join(dir, "report.json"))).toEqual({
      summary: "saved",
    });
    await symlink(join(dir, "report.json"), join(dir, "link"));
    await expect(readReport(join(dir, "link"))).rejects.toThrow();
    await writeFile(join(dir, "large"), "x".repeat(100001));
    await expect(readReport(join(dir, "large"))).rejects.toThrow(
      "Invalid report",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
