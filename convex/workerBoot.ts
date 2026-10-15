import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Only the boot hook has this capability. It cannot supply a command, instance,
// credentials, job, or research input. The full Agent37 key stays server-side.
export const reserveStart = internalMutation({
  args: {},
  handler: async (ctx) => {
    const name = "agent37-start";
    const current = await ctx.db
      .query("researchWorker")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    const now = Date.now();
    if (current && current.expires > now) return false;
    const value = { name, owner: "boot", expires: now + 5000 };
    if (current) await ctx.db.patch(current._id, value);
    else await ctx.db.insert("researchWorker", value);
    return true;
  },
});

export const start = httpAction(async (ctx, request) => {
  const token = process.env.RESEARCH_BOOT_SECRET;
  const reply = (status: number) =>
    new Response(null, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  if (!token || request.headers.get("Authorization") !== `Bearer ${token}`)
    return reply(401);
  const key = process.env.AGENT37_API_KEY;
  const instance = process.env.AGENT37_INSTANCE_ID;
  if (!key || !instance || !/^[a-z0-9]+$/.test(instance)) return reply(503);
  if (!(await ctx.runMutation(internal.workerBoot.reserveStart, {})))
    return reply(429);
  try {
    const response = await fetch(
      `https://sandbox.agent37.app/v1/instances/${instance}/exec`,
      {
        method: "POST",
        headers: { "X-Agent37-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          user: "root",
          command: "/root/signals-worker/ensure-started.sh",
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) return reply(503);
    const result = await response.json();
    // Never forward exec output (which may contain internal paths or diagnostics).
    return reply(result.exit_code === 0 ? 204 : 503);
  } catch {
    return reply(503);
  }
});
