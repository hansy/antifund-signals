import { Toaster } from "../components/ui/sonner";
import {
  HeadContent,
  Scripts,
  createRootRoute,
  Outlet,
} from "@tanstack/react-router";
import { ResearchProvider } from "../lib/client";
import stylesheet from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Investment opportunities" },
      {
        property: "og:description",
        content:
          "Explore investment ideas, review the evidence, and save your notes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Investment opportunities" },
      {
        name: "description",
        content:
          "Explore investment ideas, review the evidence, and save your notes.",
      },
    ],
    links: [
      { rel: "stylesheet", href: stylesheet },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  component: Root,
});
function Root() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ResearchProvider>
          <Outlet />
          <Toaster />
        </ResearchProvider>
        <Scripts />
      </body>
    </html>
  );
}
