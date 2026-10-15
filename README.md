# Investment signals

A proof of concept for finding investment opportunities in university research and student projects. The goal is to surface a clear problem, potential customers, and a credible path to a venture-scale business—not just an interesting invention.

## How it works

Public research pages, papers, capstone showcases, design competitions, and hackathon galleries were collected and processed locally. The work included text extraction, duplicate detection, classification, grouping related problems, and synthesizing opportunity hypotheses. Selected claims received further source research and evidence checks. Collection and commercial validation remain incomplete.

This demo contains eight selected opportunities, with supporting projects and source links. Reported results, interpretations, and open questions remain distinct. A signal is a lead for further investigation, not a validated investment recommendation.

Visitors can mark interest and save, edit, or delete notes. Voice recordings are transcribed into an editable draft before saving. **Feedback is shared in this no-login demo. Don't enter confidential information.** Interest does not start research; the research pipeline and monitor are not included.

## Technology

- **Bun and TypeScript** — tooling and tests.
- **React, TanStack Start and Router** — application and server routes.
- **TanStack Query** — fetching, caching, and feedback refresh.
- **Vite and Cloudflare Workers** — builds and hosting; Wrangler handles deployment.
- **Convex** — persistent notes, preferences, and transcript receipts.
- **OpenAI `gpt-4o-mini-transcribe`** — speech to text, called only from the server.
- **MediaRecorder, Web Audio, IndexedDB, and localStorage** — recording, upload recovery, and unsaved drafts.
- **Radix UI, Heroicons, Sonner, and CSS** — accessible controls, icons, notifications, and styling. Fonts are served by Google Fonts.
- **Zod, convex-test, and Prettier** — validation, database tests, and formatting.
- **Subscription-authenticated Codex CLI** — used during the earlier local research and synthesis; not part of the deployed runtime.

## Run locally

```sh
bun install
cp .env.example .env.local
bunx convex dev
bun run dev
```

Set `CONVEX_URL` and a random `RESEARCH_WRITE_SECRET` in `.env.local`. Set the same secret in Convex. Add `OPENAI_API_KEY` to enable voice; typed notes work without it. Local secrets and recordings are not committed.

```sh
bun run typecheck
bun test src tests
bun run build
```

## Deploy

Deploy the Convex functions with `bunx convex deploy`. Set `CONVEX_URL`, `RESEARCH_WRITE_SECRET`, and optionally `OPENAI_API_KEY` as Cloudflare Worker secrets, then run `bun run deploy`. The Convex and Worker secrets must match.

The published dataset lives in `data/`. Raw downloads, private research checkpoints, earlier experiments, notes, and credentials are excluded. Voice uploads are limited to 8 MB, with a shared cap of 50 transcription attempts per UTC day. Audio is sent to OpenAI; the app stores transcript receipts, not uploaded audio. Failed uploads remain in the originating browser for retry.
