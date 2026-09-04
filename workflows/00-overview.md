# Workflows Overview

This folder is the **W** in the WAT framework: the durable instructions the agent (Claude Code)
reads before doing any work. The single source of truth for *what* to build is
`../AI_NewsCast_Coding_Agent_Master_Specification.txt`. Everything in this folder is a
navigable breakdown of that spec — it summarizes and points back, it never contradicts it.

## Reading order

1. `architecture-communication.md` — read once, applies to every phase. Defines exactly how the
   Vercel-deployed frontend and the Trigger.dev backend talk to each other and to Supabase.
2. `phase-1-foundation.md` through `phase-7-hardening.md` — read the one you're working on,
   in order. Do not start phase N+1 until phase N's Definition of Done is fully checked off.

## Phases

| # | Phase | Goal | Status |
|---|-------|------|--------|
| 1 | Foundation | Repo, Next.js, Supabase, migrations, Trigger.dev, env config | Done |
| 2 | News pipeline | Discovery, extraction, source registry, deduplication | Done |
| 3 | Verification & summary | Verification stage, structured JSON summary, editorial safeguards | Done |
| 4 | Podcast | Script generation, ElevenLabs audio, storage, audio player | Done |
| 5 | Video | Remotion scenes, rendering, storage, video player | Done |
| 6 | Frontend & realtime | `frontend-design` skill UI, Trigger.dev Realtime, progress/result/history pages, accessibility | Done |
| 7 | Hardening | Auth, RLS, rate limiting, caching, monitoring, analytics, usage tracking, CI/CD | Done except monitoring/analytics/usage tracking (deferred by user choice) |

## Universal Definition of Done

Every phase file's own acceptance notes are *in addition to* this checklist, taken directly
from the master spec's `DEVELOPMENT METHOD` section. A phase is not complete until all seven
steps are true:

1. Typecheck passes (`node tools/verify-phase.mjs` runs `npm run typecheck`).
2. Lint passes.
3. Tests pass.
4. All errors from 1–3 are fixed, not suppressed.
5. The phase has been verified manually (the feature actually runs, not just "tests are green").
6. The completed work is documented (update the phase file's Status line and any notes).
7. Only then does work begin on the next phase.

## Cross-cutting rules that apply to every phase

Carried forward from the master spec so they don't get lost in phase-by-phase focus:

- Never let an LLM convert raw web results directly into a final video — every newscast passes
  through DISCOVER → EXTRACT → DEDUPLICATE → VERIFY → SYNTHESIZE → WRITE → NARRATE → VISUALIZE → PUBLISH.
- The frontend never calls Tavily, Firecrawl, OpenAI, or ElevenLabs directly, and never receives
  `SUPABASE_SERVICE_ROLE_KEY`, Trigger.dev secret keys, or provider API keys.
- Don't over-engineer beyond TOPIC → SEARCH → EXTRACT → VERIFY → SUMMARIZE → PODCAST → VIDEO → DISPLAY.
- Prefer small composable functions, strict TypeScript, typed interfaces, Zod schemas,
  dependency-injected providers, centralized error handling, structured logging.
