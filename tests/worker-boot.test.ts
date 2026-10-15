import { test, expect, afterEach } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
const modules = {
  "../convex/http.ts": () => import("../convex/http"),
  "../convex/workerBoot.ts": () => import("../convex/workerBoot"),
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
};
const originalFetch = globalThis.fetch;
const keys = ["RESEARCH_BOOT_SECRET", "AGENT37_API_KEY", "AGENT37_INSTANCE_ID"];
const original = keys.map((k) => process.env[k]);
afterEach(() => {
  globalThis.fetch = originalFetch;
  keys.forEach((k, i) => {
    if (original[i] === undefined) delete process.env[k];
    else process.env[k] = original[i];
  });
});
function setup() {
  process.env.RESEARCH_BOOT_SECRET = "limited-start-token";
  process.env.AGENT37_API_KEY = "server-only-key";
  process.env.AGENT37_INSTANCE_ID = "configuredinstance";
  return convexTest(schema, modules);
}
const request = {
  method: "POST",
  headers: { Authorization: "Bearer limited-start-token" },
};
test("boot capability is required and can only execute the configured fixed launcher", async () => {
  const t = setup();
  let calls = 0;
  globalThis.fetch = Object.assign(
    async (url: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      expect(url).toBe(
        "https://sandbox.agent37.app/v1/instances/configuredinstance/exec",
      );
      expect(JSON.parse(init!.body as string)).toEqual({
        user: "root",
        command: "/root/signals-worker/ensure-started.sh",
      });
      return Response.json({
        exit_code: 0,
        stdout: "private internal information",
      });
    },
    { preconnect: originalFetch.preconnect },
  );
  expect(
    (await t.fetch("/research-worker/start", { method: "POST" })).status,
  ).toBe(401);
  expect(calls).toBe(0);
  const result = await t.fetch("/research-worker/start?instance=other", {
    ...request,
    body: JSON.stringify({ command: "untrusted" }),
  });
  expect(result.status).toBe(204);
  expect(await result.text()).toBe("");
  expect((await t.fetch("/research-worker/start", request)).status).toBe(429);
  expect(calls).toBe(1);
});
test("boot failures remain retryable and never claim the worker is ready", async () => {
  const t = setup();
  globalThis.fetch = Object.assign(
    async () => Response.json({ exit_code: 75, stderr: "private error" }),
    { preconnect: originalFetch.preconnect },
  );
  const result = await t.fetch("/research-worker/start", request);
  expect(result.status).toBe(503);
  expect(await result.text()).toBe("");
});
