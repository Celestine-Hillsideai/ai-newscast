# Phase 6 — Frontend & realtime

**Status:** In progress. Next.js 16.3.4 (App Router, Turbopack) scaffolded into the existing repo
alongside Tailwind CSS v4 and the `frontend-design` skill; `npm run dev`/`build`/`start` added.
Homepage, generation page, result page, and both `/api/newscasts` routes are built and wired
end-to-end (topic in → real Trigger.dev run → realtime progress → verified result). History page
not yet started. GitHub repo created (`Celestine-Hillsideai/ai-newscast`, private, `main` branch);
not yet connected to Vercel — see "Deployment" below for what's still needed.

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

**Not yet tested against a real run** — blocked on two secrets only the user can provide:
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase dashboard) and `TRIGGER_SECRET_KEY` for `prod`
(Trigger.dev dashboard), plus enabling Anonymous Sign-ins in the Supabase dashboard (currently
off — confirmed via `/auth/v1/settings`). Typecheck, lint, and all 37 backend tests pass; the
homepage renders correctly in dev. The actual generate→realtime→result flow has not been
exercised end-to-end yet.

## Deployment

GitHub repo: `https://github.com/Celestine-Hillsideai/ai-newscast` (private, default branch
`main`). Still needed, and only the user can do these (they need account access this agent
doesn't have): connect the repo to a Vercel project (Vercel dashboard → Import Project → this
GitHub repo — authorizes Vercel's GitHub App), and set `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `TRIGGER_SECRET_KEY` in that Vercel project's Environment
Variables. Once connected, every push to `main` auto-deploys per the architecture doc's section 6
— no further action needed on this agent's part after that one-time setup.

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
