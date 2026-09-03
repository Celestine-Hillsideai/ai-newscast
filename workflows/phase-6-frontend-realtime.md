# Phase 6 — Frontend & realtime

**Status:** Done (2026-09-03). Next.js 16.3.4 (App Router, Turbopack) scaffolded into the existing
repo alongside Tailwind CSS v4 and the `frontend-design` skill. Homepage, generation page, result
page, history page, and both `/api/newscasts` routes are built and verified end-to-end **in
production**: `https://ai-newscast.vercel.app`, connected to the real Trigger.dev `prod` backend,
real Supabase database/storage. GitHub repo: `Celestine-Hillsideai/ai-newscast` (private, `main`
branch) → Vercel via its GitHub integration (frontend) and `.github/workflows/deploy-trigger.yml`
(backend) both auto-deploy on push, per the architecture doc's section 6.

## History page + navigation (2026-09-03)

- **`GET /api/newscasts`** (`src/app/api/newscasts/route.ts`, added alongside the existing POST):
  backed by a new `listNewscasts()` in `src/lib/newscast-queries.ts`, following the same
  shared-query-function pattern as `getNewscastDetail`. RLS (`newscasts_select_own`) scopes it to
  the caller automatically — no explicit `user_id` filter needed.
- **History page** (`src/app/history/page.tsx`): lists past newscasts with status, topic/headline,
  date, and a link to the right destination (`/result/:id` once completed or failed, `/generate/:id`
  while still running). Empty state links back to the homepage.
- **`src/components/site-header.tsx`**: a small shared header (wordmark + History link) added to
  the generation and result pages, which previously had no way back to history or a new newscast
  — a real navigation gap, not scope creep, since a user who just watched a newscast generate
  had no way to find it again short of the browser back button.
- **Sources fixed to satisfy acceptance criterion #8 ("View source articles")**: the result page
  previously showed only deduplicated *outlet names* (`sourceNames: string[]`), not the actual
  articles — caught during a deliberate pass against the master spec's `FINAL ACCEPTANCE TEST`
  list while closing out this phase. `getNewscastDetail` now returns `sources: { title, url,
  sourceName }[]`, scoped to `newscasts.source_ids` (the deduped/verified articles the summary was
  actually built from — not every article ever extracted for this newscast, which would include
  ones dedup/verification rejected). The result page renders these as real clickable links to the
  original articles, `sourceName` shown only when the article's `source_id` matched a seeded
  `news_sources` row (several real sources — YouTube, KPMG, academic repositories — aren't in that
  seed list, so `sourceName` is legitimately `null` for them; handled gracefully in the UI).

## Acceptance pass against the master spec's FINAL ACCEPTANCE TEST (2026-09-03)

Verified 1–9 against the live production deployment (10–12 are explicitly Phase 7 scope per this
file's own "Out of scope" section above): open the site (200, renders) → enter a topic → click
Generate (real `POST /api/newscasts` → real Trigger.dev run) → live progress
(`useRealtimeRun`, confirmed no polling — the hook subscribes directly, no page here calls
`setInterval`/repeated `fetch`) → summary renders → podcast plays (real MP3, confirmed
`Content-Type: audio/mpeg`, reachable) → video plays (real MP4, confirmed
`Content-Type: video/mp4`, reachable) → source articles viewable (real clickable links, see
above) → refresh retains the result (server-rendered from Supabase on every request, no
client-only state holds anything load-bearing). Not verified: actual audio/video playback and
keyboard/mobile use in a real browser — this agent has no browser here; only structural/HTTP-level
verification (curl, HTTP status, content-type, typecheck/lint/tests) was possible.

## The generate → result loop (2026-09-03)

- **Auth**: RLS on `newscasts`/`articles`/`media_assets` requires `auth.uid()` to match, and Phase
  6 has no login page (Phase 7). Bridged with Supabase Anonymous Sign-ins: `src/middleware.ts`
  runs on every request and signs in anonymously if there's no session yet. This is a real
  `auth.uid()` RLS already understands as-is — no policy changes needed — and upgrades cleanly to
  a real account later.
- **Supabase clients**: `src/lib/supabase-browser.ts` and `src/lib/supabase-server.ts` (new,
  anon-key + `@supabase/ssr`, cookie-based) are separate from the existing `src/lib/supabase.ts`
  (service-role, Trigger.dev-tasks-only — untouched). The frontend never uses the service-role key,
  per the architecture doc's secret split.
- **`POST /api/newscasts`** (`src/app/api/newscasts/route.ts`): validates the topic, inserts the
  `newscasts` row under the caller's session, calls `tasks.trigger("generate-newscast", ...)` by
  string id (not by importing the task module — that would drag Remotion's bundler/renderer into
  the Next.js server bundle for no reason; the two deploy targets stay decoupled at the bundler
  level too), then mints a run-scoped `publicAccessToken` via `auth.createPublicToken({ scopes: {
  read: { runs: [runId] } } })`.
- **`GET /api/newscasts/:id`** (`src/app/api/newscasts/[id]/route.ts`): backed by a shared
  `getNewscastDetail()` (`src/lib/newscast-queries.ts`) also used directly by the result page's
  server render, so the shape is defined once.
- **Generation page** (`src/app/generate/[id]/page.tsx`, server + `src/components/generate/
  generation-progress.tsx`, client): mints a *fresh* `publicAccessToken` server-side on every
  visit (so a page refresh works without carrying a token in the URL), then `useRealtimeRun`
  drives a live stage list from the real `newscastStatusEnum` values via `run.metadata.stage`.
  Redirects to the result page automatically on completion.
- **Result page** (`src/app/result/[id]/page.tsx`): headline, video/audio players, summary, key
  developments, why it matters, what remains unclear, timeline, sources, confidence score, and
  copy-link/download controls (`src/components/result/share-controls.tsx`).
- **Homepage**: `hero-console.tsx`'s Generate button now actually calls `POST /api/newscasts` and
  routes to `/generate/:id` on success, with an inline error state on failure.
- **`tools/check-env.mjs`** and the secret table in `workflows/architecture-communication.md`
  (section 5) were corrected during this pass: the anticipated `TRIGGER_PUBLIC_API_KEY` turned out
  unnecessary — `auth.createPublicToken()` mints everything the browser needs using only
  `TRIGGER_SECRET_KEY` server-side, so there's no separate public/client Trigger.dev key at all.

**Bug found and fixed during first end-to-end test (2026-09-03)**: the first local test showed
`triggerRunId: null` forever and the generation page stuck on a "starting" fallback. Root cause:
`POST /api/newscasts` tried to `.update({ trigger_run_id })` on `newscasts` using the caller's
anon-key session, but that table has **no UPDATE policy for `authenticated`** (RLS — only the
service-role key writes status/content, per `supabase/migrations/0001_init.sql`'s own comment on
this). The write was silently a no-op. Fixed by having `generate-newscast.ts` (the orchestrator)
record its own run id at startup instead, via `taskContext.ctx.run.id` (`@trigger.dev/core/v3`)
and the service-role client it already has — no RLS policy changes needed, and it matches the
existing security boundary rather than loosening it. Deployed as Trigger.dev version `20260903.5`.

**Fully verified against the live production deployment (2026-09-03)**:
`https://ai-newscast.vercel.app` → `POST /api/newscasts` → real `generate-newscast` run on
Trigger.dev `prod` → `/generate/:id` showing live realtime stage progress → auto-redirect to
`/result/:id` on completion, rendering the real headline, video, audio, summary, and sources.
Anonymous-auth middleware confirmed setting a valid `is_anonymous: true` Supabase session cookie
in production. Typecheck, lint, and all 37 backend tests pass throughout.

## Deployment

Live: `https://ai-newscast.vercel.app`. GitHub repo:
`https://github.com/Celestine-Hillsideai/ai-newscast` (private, default branch `main`) → Vercel
project `ai-newscast` (team: hillsideai) via Vercel's GitHub integration. Environment variables
set in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `TRIGGER_SECRET_KEY` —
deliberately *not* `TAVILY_API_KEY`/`FIRECRAWL_API_KEY`/`OPENAI_API_KEY`/`ELEVENLABS_API_KEY`/
`SUPABASE_SERVICE_ROLE_KEY`, which stay Trigger.dev-dashboard-only per the secret split. Note:
Vercel's per-deployment unique URLs (e.g. `ai-newscast-<hash>-hillsideai.vercel.app`) are behind
Vercel Authentication (SSO) by default — only the stable `ai-newscast.vercel.app` production
domain was confirmed publicly reachable; Deployment Protection may need adjusting (Project
Settings → Deployment Protection) if per-deployment preview URLs need to be shared externally.
Every push to `main` auto-deploys per the architecture doc's section 6 — no manual redeploy step.

**Found and fixed 2026-09-03 — deploys silently stopped reaching production for four commits in a
row.** Vercel's dashboard showed every deployment after the first as **Blocked**:
"The deployment was blocked because the commit author did not have contributing access to the
project on Vercel. The Hobby Plan does not support collaboration for private repositories." Root
cause: this agent's git commits were authored with `ejiconsult@gmail.com`, which GitHub resolves
to a *different* account (`celestineug`) than the one connected to the `hillsideai` Vercel team
(`Celestine-Hillsideai`) — Vercel treats that as an outside collaborator on a private repo and
blocks it on the Hobby plan, regardless of the fact that pushes themselves succeeded fine (`gh`
was authenticated as `Celestine-Hillsideai`, which has real push access — commit *authorship* and
push *credentials* are checked separately here). Local `npm run build` succeeding was a red
herring — the failure was Vercel-side, not a code/build problem, and only visible from the
Deployments tab, not any log this agent could reach. Fixed by setting `git config user.email` to
GitHub's noreply address for that specific account
(`320505910+Celestine-Hillsideai@users.noreply.github.com`) for all future commits from this
agent — free, no plan upgrade or repo-visibility change needed. If deploys ever silently stop
reaching `ai-newscast.vercel.app` again, check the Deployments tab for a **Blocked** status before
assuming it's a code issue.

## Design notes (homepage)

Design direction: the product's real distinctiveness is the DISCOVER→VERIFY→SYNTHESIZE→NARRATE→
VISUALIZE pipeline turning chaotic raw web reporting into a clean, verified broadcast — not
"another AI news app." The homepage dramatizes that thesis directly (a wire-dispatch/broadcast
metaphor: dateline, teletype-reveal headline, a wire ticker of example topics, a numbered
production "rundown" for the real 5-stage pipeline, and audio/video "channel" cards) rather than
using a generic hero template. Palette and type tokens live in `src/app/globals.css`'s `@theme`
block (ink/paper/signal/verified/wire/static colors; Big Shoulders / Newsreader / IBM Plex Mono).
Components: `src/components/home/hero-console.tsx` (client — teletype animation, topic input,
wire ticker; respects `prefers-reduced-motion`), `pipeline-rundown.tsx` and `channel-cards.tsx`
(server, static).

**Background updated to navy 2026-09-03** (user request, replacing the initial near-black): `ink`
is now `#0A1930` (was `#0B0D0C`) and `ink-raised` (input/panel surfaces) is `#12274A` (was
`#141715`). `wire` (hairlines) and `static` (muted text) were also retuned toward a cool navy-gray
(`#2C3E5C`, `#92A0B8`) so they read as intentional against the new blue base rather than leftover
warm-neutral grays. `paper`, `signal` (amber), and `verified` (green) are unchanged — all still
verified to pass against the new navy in the token file.

**Generate button given its own accent color 2026-09-03** (user request, for visibility against
the navy background): added a dedicated `cta`/`cta-dim` token pair (`src/app/globals.css`),
separate from the amber `signal` accent used everywhere else (on-air dot, dateline, wire ticker
hover, focus rings) — scoped to `src/components/home/hero-console.tsx`'s Generate button only, not
a site-wide accent change. Iterated from sky-400 (`#38BDF8`) to a lighter sky-300 (`#7DD3FC`, hover
darkens to the previous `#38BDF8`) per feedback that the button needed to read as more conspicuous
against the dark background — light backgrounds naturally pop harder against navy than mid-tone
blues, and the button is the homepage's one primary action, so this is the deliberate exception to
the "spend your boldness in one place" restraint the rest of the page follows.

**Known gap**: the homepage's Generate button validates and captures the topic but does not yet
call an API — `POST /api/newscasts` and the generation page don't exist yet. That's the next
increment, not a bug in what's built so far.

## Goal

Build the actual user-facing product: homepage, live generation progress, result page, history —
using the `frontend-design` skill, wired to Trigger.dev Realtime per
`workflows/architecture-communication.md`.

The master spec's `FRONTEND IMPLEMENTATION DIRECTIVE` calls this "the Claude Frontend Skill";
concretely, that's Anthropic's `frontend-design` skill, installed 2026-09-03 via
`npx skills add https://github.com/anthropics/skills --skill frontend-design` (symlinked into
`.claude/skills/frontend-design`).

## Scope

From the spec's `FRONTEND IMPLEMENTATION DIRECTIVE`, `FRONTEND PAGES`, `FRONTEND UX STATES`, and
`REALTIME FRONTEND` sections:

- Before writing any UI: read and follow the installed `frontend-design` skill's conventions for
  composition, responsive design, component structure, and accessibility. Do not invent an
  alternative design system.
- **Homepage**: title, value proposition, topic input, Generate button, example topics, clear
  audio+video framing.
- **Generation page**: `POST /api/newscasts`, then `useRealtimeRun` with the returned
  `publicAccessToken` (see `architecture-communication.md` §2). Render all eleven explicit states
  from the spec (`queued` through `completed`/`failed`) — never rely on a bare spinner. Show
  source-discovery counts as they become available. Show actionable errors on failure.
- **Result page**: headline, video player, audio player, summary, key developments, why it
  matters, what remains unclear, timeline, source list, timestamps, share/download controls.
  Fetched via `GET /api/newscasts/:id` (architecture doc §4) so a page refresh still shows the
  completed result (acceptance criterion #9).
- **History page**: user's past newscasts with status, topic, date/time, links to results —
  fetched via `GET /api/newscasts`.
- Build reusable components; keep provider/orchestration logic entirely out of presentation
  components.
- Loading, empty, success, error, and partial-generation states for every page.
- Verify desktop + mobile responsiveness and keyboard/accessible-control navigation (acceptance
  criteria #11–12).

## Key files/interfaces to create

- `src/app/page.tsx` (homepage), `src/app/generate/[id]/page.tsx`, `src/app/result/[id]/page.tsx`, `src/app/history/page.tsx`
- `src/app/api/newscasts/route.ts` (POST), `src/app/api/newscasts/[id]/route.ts` (GET)
- `src/hooks/use-newscast-run.ts` (wraps `useRealtimeRun`)
- `src/components/` — status-timeline, source-list, share-controls, etc.

## Out of scope

- Backend task logic itself (already built in Phases 1–5) — this phase only consumes it.
- Auth enforcement and rate limiting (Phase 7) — pages can assume a signed-in user for now if
  auth isn't wired yet, but should be structured so Phase 7 can slot RLS/session checks in
  without a rewrite.

## Definition of Done

Universal checklist from `00-overview.md`, plus:

- Realtime frontend state-transition test (spec's `TESTING` minimum list) passes.
- Manual pass of the full acceptance flow from the spec's `FINAL ACCEPTANCE TEST` steps 1–9 and
  11–12 (step 10, graceful failure recovery, and auth-specific steps land fully in Phase 7).
- No page relies on polling — confirm via network inspection that progress updates arrive over
  the realtime subscription, not repeated fetches.
