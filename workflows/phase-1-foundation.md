# Phase 1 — Foundation

**Status:** Backend slice built and verified end-to-end in both environments. All ten
Trigger.dev tasks run the full chain (discover → extract → deduplicate → verify → summarize →
script → audio → video → finalize) against the real Supabase project (migration applied, RLS
enabled, 14 news sources seeded), reaching `newscasts.status: completed`.

- **Dev**: verified via `npx trigger.dev dev` (orchestrator Success in 26.7s).
- **Production**: deployed via `npx trigger.dev deploy` (version 20260901.2, 10 tasks detected,
  deploy `db82ihsk`) and smoke-tested successfully. Version 20260901.1 hit a real bug fixed along
  the way — see "Known issues fixed" below.

Next.js/Vercel frontend scaffolding deliberately deferred to a later session — see
`workflows/architecture-communication.md` for the contract it will build against. This phase's
backend slice is otherwise done; remaining Definition of Done items (typecheck/lint/test — all
currently passing) should be re-checked whenever the frontend half is added.

## Known issues fixed

- **WebSocket error in production only.** `@supabase/supabase-js` constructs a `RealtimeClient`
  internally, which requires a WebSocket implementation to exist at construction time — even
  though these tasks only ever do REST calls (`.from().select/insert/update()`), never realtime
  channels. Trigger.dev's production Docker image runs Node 21, which predates Node's native
  `WebSocket` (added in Node 22); local dev used a newer Node, which is why it worked there but
  failed with `Error: Node.js detected but native WebSocket not found` in production. Fixed in
  `src/lib/supabase.ts` by installing `ws` and passing it explicitly as
  `realtime: { transport: WebSocket }` when creating the client — works identically on any Node
  version. If a future phase upgrades the Trigger.dev runtime to Node 22+, this shim is still
  harmless to leave in place.

## Goal

Stand up the repo, the Next.js app, Supabase, Trigger.dev, and environment configuration —
nothing news-related yet.

## Scope

- Initialize the Next.js (TypeScript, Tailwind, shadcn/ui) app at the repo root.
- `git init`, initial commit, `.gitignore` for Node/Next.js/env files.
- Create the Supabase project wiring and initial migrations for all seven tables from the spec's
  `DATABASE` section: `profiles`, `newscasts`, `articles`, `news_sources`, `media_assets`,
  `generation_events`, `usage_records`. Enable RLS on all of them (policies can start minimal —
  full hardening is Phase 7).
- Seed `news_sources` with the initial registry from the spec's `NEWS SOURCES` section (14 named
  outlets), each with name, domain, homepage URL, optional RSS URL, priority, trust score,
  enabled flag.
- Create `trigger.config.ts` and `src/trigger/` with stub tasks for the ten tasks named in the
  spec's `TRIGGER.DEV WORKFLOW TASKS` section (bodies can be no-ops for now — this phase proves
  wiring, not behavior): `generate-newscast`, `discover-news`, `extract-articles`,
  `deduplicate-news`, `verify-news`, `summarize-news`, `generate-podcast-script`,
  `generate-audio`, `generate-video`, `finalize-newscast`.
- Create `src/lib/schemas/` for shared Zod schemas (topic input, newscast status enum) — these
  will be imported by both API routes and tasks per `workflows/architecture-communication.md`.
- Create `.env.example` covering every variable in that same doc's secret table.
- Add `tools/check-env.mjs` groups to match whatever the real env var names end up being once
  Supabase/Trigger.dev projects are created (update the script if names differ from the plan).

## Key files/interfaces to create

- `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- `supabase/migrations/0001_init.sql` (all seven tables + RLS)
- `trigger.config.ts`
- `src/trigger/*.ts` (ten stub tasks)
- `src/lib/schemas/newscast.ts`
- `.env.example`

## Out of scope

- Any actual news search, extraction, verification, audio, or video logic (Phases 2–5).
- Frontend polish beyond a placeholder homepage (Phase 6).
- Auth enforcement, rate limiting, production monitoring (Phase 7).

## Definition of Done

Universal checklist from `00-overview.md`, plus:

- `npx tsc --noEmit`, lint, and a trivial test all pass.
- `npx supabase db push` (or equivalent) applies migrations cleanly to a local/dev Supabase project.
- `npx trigger.dev@latest dev` successfully registers all ten stub tasks.
- `node tools/check-env.mjs --group=all` reports every variable this phase introduced.

## Manual setup steps (run these yourself)

These touch your real Trigger.dev and Supabase accounts, so they're not run from this session —
secrets never get typed into chat, and a live schema change is yours to run deliberately. Do them
in order:

1. **Trigger.dev project ref.** Open your Trigger.dev dashboard → Project settings, copy the
   project ref (looks like `proj_xxxxxxxxxxxx` — not a secret), and paste it into
   `trigger.config.ts` in place of `"YOUR_PROJECT_REF"`.
2. **Local env file.** Copy `.env.example` to `.env` and fill in `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` from your Supabase project's Settings → API page. `.env` is
   gitignored — never commit it.
3. **Apply the migration.** Open your Supabase project's SQL editor, paste the full contents of
   `supabase/migrations/0001_init.sql`, and run it. (If you have the Supabase CLI linked instead,
   `supabase db push` works too.) Confirm in the Table editor that all seven tables exist and
   `news_sources` has 14 rows.
4. **Trigger.dev environment variables.** In the Trigger.dev dashboard → your project →
   Environment Variables, add the same `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the
   `dev` environment (and later `staging`/`prod` when you deploy there) — deployed task runs read
   from here, not from your local `.env`.
5. **Authenticate the CLI.** Run `npx trigger.dev@latest login` in this project's root directory
   and complete the browser sign-in.
6. **Run it.** `npx trigger.dev@latest dev` — this registers all ten tasks and keeps a local dev
   session open.
7. **Test a run.** `newscasts.user_id` has a foreign key into `auth.users`, and that constraint
   is enforced regardless of RLS — so the test row needs a real user id, not an arbitrary UUID.
   If you don't already have one, create one via **Authentication → Users → Add user** in the
   Supabase dashboard (check "Auto Confirm User"), then copy its UID. Create the test row in the
   Supabase SQL editor:
   ```sql
   insert into newscasts (id, user_id, topic)
   values ('00000000-0000-0000-0000-000000000001', '<real-user-uuid-from-auth.users>', 'CBN interest rate decision')
   returning id;
   ```
   Then, in the Trigger.dev dashboard's "Test" tab for the `generate-newscast` task, trigger it
   with `{ "newscastId": "00000000-0000-0000-0000-000000000001", "topic": "CBN interest rate
   decision" }`. Watch the run's log stream in the dashboard and confirm the same row in
   Supabase's table editor advances through `researching → extracting → deduplicating →
   verifying → summarizing → scripting → generating_audio → generating_video → finalizing →
   completed`.
8. **Deploy.** Once step 7 looks right, `npx trigger.dev@latest deploy` to ship it to your
   Trigger.dev production environment (make sure step 4's env vars also exist in that
   environment).
