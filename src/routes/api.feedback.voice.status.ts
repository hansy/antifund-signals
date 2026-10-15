import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
export const Route = createFileRoute("/api/feedback/voice/status")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { available: !!env.OPENAI_API_KEY },
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
