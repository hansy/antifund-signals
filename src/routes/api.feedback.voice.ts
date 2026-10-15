import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { voice } from "../server/demo";
export const Route = createFileRoute("/api/feedback/voice")({
  server: { handlers: { POST: ({ request }) => voice(request, env) } },
});
