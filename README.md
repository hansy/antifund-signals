# Investment signals

A proof of concept for finding investment opportunities in university research and student projects. The goal is to surface a clear problem, potential customers, and a credible path to a venture-scale business—not just an interesting invention.

## How it works

Public research pages, papers, capstone showcases, design competitions, and hackathon galleries were collected and processed locally. The work included text extraction, duplicate detection, classification, grouping related problems, and synthesizing opportunity hypotheses. Selected claims received further source research and evidence checks. Collection and commercial validation remain incomplete.

This demo contains eight selected opportunities, with supporting projects and source links. Reported results, interpretations, and open questions remain distinct. A signal is a lead for further investigation, not a validated investment recommendation.

Visitors can mark interest and save, edit, or delete notes. Voice recordings are transcribed into an editable draft before saving. **Feedback is shared in this no-login demo. Don't enter confidential information.** Interest queues research on the configured Agent37 worker. Clearing interest pauses the active task; marking it again resumes from completed steps. The archived research pipeline and monitor are not included.

## Technology

- **Bun and TypeScript** — tooling and tests.
- **React, TanStack Start and Router** — application and server routes.
- **TanStack Query** — fetching, caching, and feedback refresh.
- **Vite and Cloudflare Workers** — builds and hosting; Wrangler handles deployment.
- **Convex** — persistent notes, preferences, transcript receipts, research jobs and evidence archives.
- **OpenAI `gpt-4o-mini-transcribe`** — speech to text, called only from the server.
- **MediaRecorder, Web Audio, IndexedDB, and localStorage** — recording, upload recovery, and unsaved drafts.
- **Radix UI, Heroicons, Sonner, and CSS** — accessible controls, icons, notifications, and styling. Fonts are served by Google Fonts.
- **Zod, convex-test, and Prettier** — validation, database tests, and formatting.
- **Agent37 and subscription-authenticated Codex** — hosted opportunity research, one active task at a time.

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

## Hosted research

The existing Agent37 Codex instance runs `scripts/agent37-worker.ts` (bundled for Node). Convex owns the queue and leases; Agent37 owns the model execution. Research has three saved steps: problem/customer, market/alternatives, and investment case. Each step has a ten-minute limit. Up to twelve attempts per signal prevent unbounded retries. Test-mode preferences never run research.

The worker retains originals, excerpts and reports in an evidence archive in private Convex storage. Completion means **awaiting evidence review**, not Exploring: it never replaces published signal content automatically. Missing sources and uncertain market claims remain explicit gaps.

Configure `RESEARCH_ENABLED=true` and a separate random `RESEARCH_WORKER_SECRET` in Convex. The root-owned worker config contains the production Convex URL, worker secret, Agent37 API key and instance ID. These credentials are not exposed to the Codex process. The worker uses Agent37's supported response/cancel API and reattaches to the same response after a disconnect. An uncertain dispatch stops the worker for reconciliation rather than repeating a model call.

The hosted launcher uses a process lock; a Convex lease also rejects duplicate workers. Completed steps survive pause/restart. A worker interrupted mid-step marks that job for attention after reconciling its remote response. Resume it by clearing and restoring interest. After an instance reboot, restart the worker through Agent37’s authenticated exec API; template image updates require reinstalling it. The current template cannot launch a root-owned worker from its unprivileged boot hook. Completed attempt directories are sealed for private inspection. This is a shared demo on one operator-owned agent instance, not a multi-tenant sandbox; do not supply confidential notes.
