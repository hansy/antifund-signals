import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handleNotes } from "../server/notes-handler";
import { convexNotes } from "../server/notes-store";
async function handle({ request }: { request: Request }) {
  try {
    return await handleNotes(
      request,
      convexNotes(
        env as { CONVEX_URL?: string; RESEARCH_WRITE_SECRET?: string },
      ),
    );
  } catch {
    return Response.json(
      { error: "Notes storage is not configured." },
      { status: 503 },
    );
  }
}
export const Route = createFileRoute("/api/notes")({
  server: { handlers: { GET: handle, POST: handle } },
});
