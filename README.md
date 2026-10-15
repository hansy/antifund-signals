# Investment signals

A proof of concept for finding investment opportunities in university research and student projects. The goal is to surface clear problems, potential customers, and credible paths to venture-scale businesses.

## Focus

[Anti Fund’s thesis](https://antifund.com/manifesto) emphasizes robotics, automation, defense, energy, and manufacturing.

I looked for opportunities in those areas, along with the AI, computing, sensing, and infrastructure that enable them.

## Methodology

1. **Built the first five leads.** A curated starting set of 26 projects from ten schools, dated 2021–2026, supported five opportunity briefs.
2. **Expanded collection.** Broad discovery reached 50 school-associated collections, then focused on 2025–2026 showcases at Georgia Tech, Berkeley, Waterloo, MIT, and Stanford. Sources included research pages, papers, capstones, design competitions, and hackathon galleries.
3. **Saved the source material.** Across both collections, we downloaded 4,976 unique URLs: 4,766 HTML/page/API responses and 210 PDFs.
4. **Processed the focused corpus.** Its 4,175 sources yielded 6,669 records. All received initial analysis through 6,584 source packets, producing 6,187 candidate interpretations in 628 thematic groups.
5. **Tried deeper review too early.** The old pipeline completed deeper judgments for 235 of 628 groups and 117 problem-size research results before it was stopped. Individual project evaluation and source checks consumed time without reliably producing strong opportunities.
6. **Tested cheap opportunity synthesis.** I selected six areas spanning 18 of the 628 groups. Those groups held 299 candidate records; We read a bounded sample of 48, checked supporting passages, and drafted three opportunity hypotheses using saved data only. This was a small experiment, not a ranking of the whole corpus.
7. **Brought opportunities into the demo.** The collection combines curated briefs and hypotheses drawn from the corpus, with supporting projects and source links. It grows as further opportunities are identified and reviewed. These are leads for investigation, not validated investment cases.

## Using the demo

- Browse opportunities, open one to see its supporting research, and mark it as interesting to queue deeper research
- Add notes by typing or recording your voice; notes used to help tune opportunity synthesis

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

Deploy Convex with `bunx convex deploy`, configure Cloudflare secrets (`CONVEX_URL`, `RESEARCH_WRITE_SECRET`, and `OPENAI_API_KEY` for voice), then run `bun run deploy`. Use the same write secret in Convex and Cloudflare.

## Hosted research

An Agent37 worker uses subscription-authenticated Codex to research interested signals. Convex manages the queue and saved progress. Research covers customers, markets, alternatives, and the investment case; results require evidence review before publication.
