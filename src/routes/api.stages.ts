import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { stages } from "../server/demo";
export const Route = createFileRoute("/api/stages")({
  server: { handlers: { GET: ({ request }) => stages(request, env) } },
});
