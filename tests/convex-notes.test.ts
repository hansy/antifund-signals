import { test, expect, beforeEach, afterEach } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { handleNotes } from "../src/server/notes-handler";
import { type NoteCommand } from "../src/lib/signal-notes";
const modules = {
  "../convex/notes.ts": () => import("../convex/notes"),
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
};
const secret = "test-notes-capability";
const original = process.env.RESEARCH_WRITE_SECRET;
beforeEach(() => {
  process.env.RESEARCH_WRITE_SECRET = secret;
});
afterEach(() => {
  if (original === undefined) delete process.env.RESEARCH_WRITE_SECRET;
  else process.env.RESEARCH_WRITE_SECRET = original;
});
const create: NoteCommand = {
  type: "create",
  actor: "test",
  cardId: "synthesis-o01",
  id: "note-1",
  requestId: "create-1",
  reviewer: "ui-test",
  sessionId: "session",
  text: "First thought",
  segmentIds: ["segment-1"],
};
function setup() {
  const t = convexTest(schema, modules);
  const write = (command: NoteCommand) =>
    t.mutation(api.notes.write, { secret, command: JSON.stringify(command) });
  const list = (
    actor: "operator" | "test" = "test",
    cardId = "synthesis-o01",
  ) => t.query(api.notes.list, { secret, actor, cardId });
  return { t, write, list };
}
test("Convex notes persist, append independently and retry without duplicates", async () => {
  const { t, write, list } = setup();
  await write(create);
  await write(create);
  await write({
    ...create,
    id: "note-2",
    requestId: "create-2",
    text: "Second thought",
    segmentIds: [],
  });
  expect((await list()).map((n) => n.text)).toEqual([
    "First thought",
    "Second thought",
  ]);
  expect(await list("operator")).toEqual([]);
  expect(await list("test", "other")).toEqual([]);
  await expect(
    t.query(api.notes.list, { secret: "wrong", actor: "test" }),
  ).rejects.toThrow("Unauthorized");
  await expect(write({ ...create, text: "Overwrite" })).rejects.toThrow(
    "already used",
  );
});
test("edit and soft-delete use versions; retry does not overwrite a later edit; undo restores the edited note", async () => {
  const { t, write, list } = setup();
  await write(create);
  const edit: NoteCommand = {
    type: "edit",
    actor: "test",
    cardId: create.cardId,
    id: create.id,
    requestId: "edit-1",
    expectedVersion: 1,
    text: "Edited thought",
  };
  await write(edit);
  await write(edit);
  expect((await list())[0]?.version).toBe(2);
  await expect(
    write({ ...edit, requestId: "stale-tab", text: "Lost update" }),
  ).rejects.toThrow("another window");
  await expect(
    write({
      ...edit,
      cardId: "synthesis-o02",
      requestId: "wrong-signal",
      expectedVersion: 2,
    }),
  ).rejects.toThrow("not found");
  await write({
    type: "delete",
    actor: "test",
    cardId: create.cardId,
    id: create.id,
    requestId: "delete-1",
    expectedVersion: 2,
  });
  expect((await list())[0]?.deleted).toBe(true);
  await write(edit); // Old request receipt must not resurrect or roll back.
  expect((await list())[0]?.deleted).toBe(true);
  await write({
    type: "restore",
    actor: "test",
    cardId: create.cardId,
    id: create.id,
    requestId: "restore-1",
    expectedVersion: 3,
  });
  const note = (await list())[0]!;
  expect(note).toMatchObject({
    text: "Edited thought",
    deleted: false,
    version: 4,
    segmentIds: ["segment-1"],
  });
  const audit = await t.run((ctx) =>
    ctx.db.query("signalNoteChanges").collect(),
  );
  expect(audit).toHaveLength(4);
  expect(audit.find((c) => c.requestId === "edit-1")?.previousText).toBe(
    "First thought",
  );
});
test("notes HTTP rejects cross-origin and malformed writes, returns cloud conflicts, and permits CRUD without a decision", async () => {
  const { write, list } = setup();
  const store = {
    write: async (command: NoteCommand) => {
      await write(command);
    },
    list,
  };
  const request = (command: NoteCommand, origin = "http://localhost:3010") =>
    new Request("http://localhost:3010/api/notes", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
  expect(
    (await handleNotes(request(create, "https://other.example"), store)).status,
  ).toBe(403);
  expect((await handleNotes(request(create), store)).status).toBe(200);
  const response = await handleNotes(
    new Request(
      "http://localhost:3010/api/notes?actor=test&cardId=synthesis-o01",
    ),
    store,
  );
  expect((await response.json()).notes).toHaveLength(1);
  const edit: NoteCommand = {
    type: "edit",
    actor: "test",
    cardId: create.cardId,
    id: create.id,
    requestId: "edit",
    expectedVersion: 9,
    text: "Stale",
  };
  expect((await handleNotes(request(edit), store)).status).toBe(409);
});

test("voice segments can only be consumed by one cloud note, including after soft deletion", async () => {
  const { write, list } = setup();
  const results = await Promise.allSettled([
    write(create),
    write({ ...create, id: "second", requestId: "second" }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const n = (await list())[0]!;
  await write({
    type: "delete",
    actor: "test",
    cardId: n.cardId,
    id: n.id,
    expectedVersion: n.version,
    requestId: "delete-voice",
  });
  await expect(
    write({ ...create, id: "third", requestId: "third" }),
  ).rejects.toThrow("recording already belongs");
  expect(await list()).toHaveLength(1);
});

test("a committed delete with a failed response remains discoverable and restorable after reload", async () => {
  const { write, list } = setup();
  await write(create);
  const response = await handleNotes(
    new Request("http://localhost:3010/api/notes", {
      method: "POST",
      headers: {
        Origin: "http://localhost:3010",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "delete",
        actor: "test",
        cardId: create.cardId,
        id: create.id,
        expectedVersion: 1,
        requestId: "lost-response",
      }),
    }),
    {
      write: async (c) => {
        await write(c);
      },
      list: async () => {
        throw Error("Temporary read failure");
      },
    },
  );
  expect(response.status).toBe(503);
  const reloaded = await handleNotes(
    new Request(
      "http://localhost:3010/api/notes?actor=test&cardId=synthesis-o01",
    ),
    {
      write: async (c) => {
        await write(c);
      },
      list,
    },
  );
  const n = (await reloaded.json()).notes[0];
  expect(n.deleted).toBe(true);
  await write({
    type: "restore",
    actor: "test",
    cardId: n.cardId,
    id: n.id,
    expectedVersion: n.version,
    requestId: "recover",
  });
  expect((await list())[0]?.deleted).toBe(false);
});
