# AI NewsCast

## Product objective

AI NewsCast turns a Nigerian breaking-news topic into a verified, produced newscast: it
searches Nigerian outlets, extracts and deduplicates articles, verifies claims, synthesizes a
structured editorial briefing, narrates it as a 3–6 minute podcast (ElevenLabs), renders a
programmatic news video (Remotion), and publishes both in a web app. The pipeline is always
DISCOVER → EXTRACT → DEDUPLICATE → VERIFY → SYNTHESIZE → WRITE → NARRATE → VISUALIZE → PUBLISH —
an LLM is never allowed to turn raw web results directly into a final video.

**The full, authoritative requirements live in
[`AI_NewsCast_Coding_Agent_Master_Specification.txt`](AI_NewsCast_Coding_Agent_Master_Specification.txt).**
Everything below summarizes that spec for day-to-day navigation. If anything here ever conflicts
with it, the spec wins — fix this file, don't work around the spec.

## The WAT framework

This repo organizes the *build process itself* around three roles:

- **W — Workflows** (`workflows/`): durable instruction documents, broken down by phase, that
  tell the agent what to build and in what order. Start at
  [`workflows/00-overview.md`](workflows/00-overview.md).
- **A — Agent**: Claude Code — no folder. It reads this file and `workflows/`, and uses
  `tools/` to check its own work.
- **T — Tools** (`tools/`): scripts that enforce the workflow's discipline (environment
  validation, phase verification). Not application source code — see
  [`tools/README.md`](tools/README.md).

## Operating procedure

Before starting work on a phase:
1. Read [`workflows/00-overview.md`](workflows/00-overview.md).
2. Read the relevant `workflows/phase-N-*.md` file.
3. Read [`workflows/architecture-communication.md`](workflows/architecture-communication.md) if the work touches how the frontend and backend talk to each other.

After finishing work on a phase:
1. Run `node tools/verify-phase.mjs` (typecheck → lint → test).
2. Verify the phase manually — it actually runs, not just green tests.
3. Update that phase file's `Status` line and any relevant notes.
4. Do not start the next phase until the current one is stable.

This mirrors the master spec's `DEVELOPMENT METHOD` section exactly.

## Repository map

```
/
├── CLAUDE.md                                    (this file)
├── AI_NewsCast_Coding_Agent_Master_Specification.txt   (source of truth)
├── workflows/                                   W — instructions
│   ├── 00-overview.md
│   ├── architecture-communication.md
│   ├── phase-1-foundation.md
│   ├── phase-2-news-pipeline.md
│   ├── phase-3-verification-and-summary.md
│   ├── phase-4-podcast.md
│   ├── phase-5-video.md
│   ├── phase-6-frontend-realtime.md
│   └── phase-7-hardening.md
├── tools/                                       T — scripts
│   ├── README.md
│   ├── check-env.mjs
│   └── verify-phase.mjs
├── src/                                         created in Phase 1 (not yet present)
│   ├── app/                                     Next.js routes, incl. app/api/*
│   ├── trigger/                                 Trigger.dev tasks
│   ├── lib/                                     provider interfaces, Zod schemas, shared logic
│   └── components/
├── supabase/migrations/                         created in Phase 1
└── package.json, trigger.config.ts, .env.example   created in Phase 1
```

## Frontend ↔ backend communication (condensed)

Single repo, two deploy targets: the Next.js app deploys to **Vercel** via its GitHub
integration; the tasks under `src/trigger/` deploy independently to **Trigger.dev** via its CLI.
They never call each other's private APIs — they communicate through:

1. **Trigger**: browser → `POST /api/newscasts` (Vercel, server-side) → validates topic, writes
   a `newscasts` row, calls the Trigger.dev SDK server-side to start the run, returns
   `{ newscastId, runId, publicAccessToken }`.
2. **Live progress**: browser → Trigger.dev Realtime, *directly*, using `publicAccessToken` (no
   polling, Vercel not involved).
3. **Persistence**: each task writes its stage to Supabase (`newscasts.status`,
   `generation_events`) as it goes, so a page refresh still shows correct state.
4. **Reading results/history**: browser → typed Next.js API routes (`GET /api/newscasts[/:id]`)
   → Supabase, server-side.

Full contract, sequence diagram, and the per-secret ownership table:
[`workflows/architecture-communication.md`](workflows/architecture-communication.md).

## Environment variable split

| Lives in | Examples | Why |
|---|---|---|
| Vercel, client-safe (`NEXT_PUBLIC_*`) | Supabase URL/anon key, Trigger.dev public API key, PostHog key | Safe to ship in the browser bundle |
| Vercel, server-only | `TRIGGER_SECRET_KEY`, Sentry DSN | Used inside API routes (Node runtime), never bundled to the client |
| Trigger.dev dashboard only | `SUPABASE_SERVICE_ROLE_KEY`, `TAVILY_API_KEY`, `FIRECRAWL_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY` | Full-privilege or paid-provider secrets; tasks run entirely server-side on Trigger.dev's infrastructure |

The frontend must never call Tavily, Firecrawl, OpenAI, or ElevenLabs directly, and must never
receive `SUPABASE_SERVICE_ROLE_KEY`, Trigger.dev secret keys, or any provider API key. Checkable
version: `node tools/check-env.mjs --group=all` (full detail:
[`workflows/architecture-communication.md`](workflows/architecture-communication.md) §5).

## Deployment model

1. GitHub is the source of truth — one repo, both deploy targets read from it.
2. Push to `main` → Vercel's GitHub integration builds and deploys the Next.js app automatically.
3. Trigger.dev tasks deploy independently via `npx trigger.dev@latest deploy`; a GitHub Actions
   job wires this into the same push in Phase 7 (`workflows/phase-7-hardening.md`).
4. Because both sides import the same Zod schemas from `src/lib/schemas/`, the API contract
   between them can't silently drift.

## Hard rules

- Never let raw web results reach the video/audio stages without passing through verification
  and structured editorial synthesis.
- Frontend components hold no provider/orchestration logic — only typed calls to Next.js API
  routes.
- Don't over-engineer beyond TOPIC → SEARCH → EXTRACT → VERIFY → SUMMARIZE → PODCAST → VIDEO → DISPLAY.
- Small composable functions, strict TypeScript, typed interfaces, Zod schemas everywhere,
  dependency-injected providers, structured logging, versioned prompts.
- Implement phases incrementally, in order; don't start a phase until the previous one's
  Definition of Done is fully checked off.

## Current status

**Phases 0–6 complete** and verified end-to-end in production at
[ai-newscast.vercel.app](https://ai-newscast.vercel.app). **Phase 7 (hardening)** has one item
done (CI/CD — both deploy targets auto-deploy on push to `main`); auth enforcement, full RLS,
rate limiting, monitoring, analytics, and usage tracking are not yet started — see
[`workflows/phase-7-hardening.md`](workflows/phase-7-hardening.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
