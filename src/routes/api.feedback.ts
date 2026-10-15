import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { feedback } from "../server/demo";
const handle = ({ request }: { request: Request }) => feedback(request, env);
export const Route = createFileRoute("/api/feedback")({
  server: { handlers: { GET: handle, POST: handle } },
});
