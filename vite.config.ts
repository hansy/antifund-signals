import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ command, mode, isPreview }) => {
  // Native dev networking handles unavailable IPv6 routes. Builds and previews
  // still use Workers; `dev:workers` opts into local platform emulation.
  const nativeDev = command === "serve" && !isPreview && mode !== "workers";
  if (nativeDev) {
    const values = loadEnv(mode, process.cwd(), "");
    for (const key of ["CONVEX_URL", "RESEARCH_WRITE_SECRET", "OPENAI_API_KEY"])
      process.env[key] ??= values[key];
  }

  return {
    server: {
      fs: {
        deny: [
          ".env",
          ".env.*",
          "*.{crt,pem}",
          "**/.git/**",
          "**/.research-cache/**",
          "**/.dev.vars*",
          "**/work/**",
        ],
      },
    },
    resolve: {
      tsconfigPaths: true,
      alias: nativeDev
        ? {
            "cloudflare:workers": fileURLToPath(
              new URL("./src/server/dev-bindings.ts", import.meta.url),
            ),
          }
        : undefined,
    },
    plugins: [
      ...(!nativeDev ? cloudflare({ viteEnvironment: { name: "ssr" } }) : []),
      tanstackStart(),
      react(),
    ],
  };
});
