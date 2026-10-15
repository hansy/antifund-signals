import { createFileRoute } from "@tanstack/react-router";
import corpus from "../../data/corpus.json";
export const Route = createFileRoute("/api/corpus")({
  server: {
    handlers: {
      GET: () =>
        Response.json(corpus, {
          headers: { "Cache-Control": "public, max-age=60" },
        }),
    },
  },
});
