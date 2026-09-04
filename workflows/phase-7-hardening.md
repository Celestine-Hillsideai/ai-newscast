# Phase 7 — Hardening

**Status:** In progress (started 2026-09-03). CI/CD (pulled forward earlier), RLS hardening, and
error-handling's retry-cost fix are done. Auth is confirmed already satisfied by Phase 6's
anonymous-auth architecture — the user explicitly decided this phase's "auth" work should be a
hardening/verification pass, not a new login system (spec's acceptance test never tests login).
Caching completeness and structured logging were audited and found already satisfied by earlier
phases — no new work needed. Rate limiting on `POST /api/newscasts` is done. Not started: Sentry,
PostHog, usage tracking (all need either external credentials or a scoping decision — see below).

## Findings from this pass (2026-09-03)

- **Auth — already satisfied, no new work**: every route/page requires a session (anonymous or
  real) via `src/middleware.ts`, and RLS scopes every table to `auth.uid()`. Verified this holds
  even for anonymous sessions, per the user's explicit decision not to add a login UI this phase.
- **RLS hardening — one real gap found and fixed**: audited all seven tables' policies
  (`supabase/migrations/0001_init.sql`). Six were already correct. `newscasts_insert_own` checked
  row ownership but not content — any client holding the anon key could insert a `newscasts` row
  with a forged `status: 'completed'` and fabricated headline/summary directly via PostgREST,
  bypassing the verification pipeline entirely (self-visible only — `newscasts_select_own` still
  blocks other users from seeing it — but a real integrity gap, since the product's whole premise
  is that nothing reaches `completed` without verification). Fixed in
  `supabase/migrations/0005_rls_hardening.sql`, restricting inserts to exactly the shape
  `POST /api/newscasts` creates (status='queued', every content column at its default).
  **Not yet applied to the live database** — this agent has no way to run raw DDL (only the REST
  data API via service-role key, not a Postgres connection or Management API token); apply via the
  Supabase dashboard's SQL Editor, same as prior migrations.
- **Rate limiting — done**: `src/lib/rate-limit.ts`, wired into `POST /api/newscasts`. Backed by a
  `COUNT` query against `newscasts` itself (already RLS-scoped to the caller) rather than a new
  table or external service (Upstash, etc.) — 3 requests per 10 minutes per user, returned as a
  429 with `Retry-After`. Deliberately tight: each request triggers a pipeline that calls five
  paid providers.
- **Error handling — retry policy at the HTTP level was already correct** (`src/lib/http-retry.ts`
  implements exactly "retry 429/5xx, never retry 400/401/403/404", used by every provider call —
  verified via `grep`, no raw `fetch()` calls bypass it). **Found and fixed a real gap above that
  layer**: `generate-newscast` (the orchestrator) inherited `trigger.config.ts`'s global
  `maxAttempts: 3`, meaning any failure — including permanent ones — re-ran the *entire* pipeline
  from scratch up to 3 times. Directly observed during Phase 5 testing: an ElevenLabs
  `quota_exceeded` error (can never succeed on retry) caused 3 full re-runs, tripling the
  Tavily/Firecrawl/OpenAI cost of a guaranteed failure. Fixed with a per-task `retry: { maxAttempts:
  1 }` override on `generate-newscast` — child tasks keep their own retry safety net (Trigger.dev's
  default 3 attempts, on top of `fetchWithRetry`'s own backoff) for transient failures; only the
  wasteful whole-pipeline re-run is removed. A user can always click Generate again, which costs
  the same as an automatic retry but gives them visibility instead of silent background burn.
  `newscasts.status = 'failed'` with a stored, actionable message was already unconditional
  (`generate-newscast.ts`'s `catch` block) — verified, not changed.
- **Caching completeness — already satisfied, no new work**: all five spec-required surfaces
  (search results, extracted articles, summaries, audio, video) already cache via
  `provider_cache`/content-hash/`media_assets.hash` — verified via `grep` across `src/trigger/`,
  not re-implemented.
- **Structured logging — already substantially satisfied, no new abstraction added**: every task
  logs with `newscastId` consistently, and `updateNewscastStatus` already writes a durable
  `generation_events` row per stage (`stage`, `provider`, `duration_ms`, `status`, `error`,
  `metadata`) — this table *is* the structured, queryable, per-newscast trail the spec's logging
  bullet asks for. Did not add a redundant custom logger wrapper on top of what already exists.
- **Not started**: Sentry, PostHog (both need an account/API key from the user), usage tracking
  (needs either real provider pricing data or an explicit decision to track quantity/duration only
  and leave `cost_usd` null, since `usage_records` is never written anywhere yet).

## Goal

Make the MVP production-safe: auth, RLS, rate limiting, caching completeness, monitoring,
analytics, usage tracking, and CI/CD for both deploy targets.

## Scope

- **Auth**: enforce Supabase Auth on every API route and page; users may only access their own
  generated content (spec's `DATABASE` section).
- **RLS hardening**: move from Phase 1's minimal policies to full per-table, per-user policies
  across all seven tables.
- **Rate limiting**: on `POST /api/newscasts` at minimum.
- **Caching completeness**: confirm all five caching surfaces from the spec are implemented and
  deterministic — search results, extracted articles, summaries, audio, video.
- **Monitoring (Sentry)**: wire API errors, Trigger.dev task errors, Remotion render errors, and
  client errors, on both the Vercel and Trigger.dev sides.
- **Analytics (PostHog)**: fire all eight named events — `newscast_started`,
  `newscast_completed`, `video_played`, `audio_played`, `source_clicked`, `newscast_shared`,
  `newscast_downloaded`, plus any correlating properties (newscastId).
- **Logging**: correlation ID per newscast; every workflow log line includes newscastId, taskId,
  stage, provider, duration, status, error if applicable.
- **Error handling**: retry 429/500/502/503/504; never blindly retry 400/401/403/404; every
  failed workflow sets `newscasts.status = 'failed'` with an actionable stored error message
  (this is also acceptance criterion #10 — graceful recovery from a failed generation).
- **CI/CD — done 2026-09-03**: `.github/workflows/deploy-trigger.yml` runs
  `npx trigger.dev@4.5.15 deploy` on push to `main`, path-filtered to `src/trigger/**`,
  `src/lib/**`, `src/remotion/**`, `trigger.config.ts`, and the package files (broader than the
  original `src/trigger/**`-only plan, since backend tasks import shared lib/Remotion code too —
  a change there should redeploy the backend as well). Authenticates via `TRIGGER_ACCESS_TOKEN`,
  a Personal Access Token (`tr_pat_...`, from `cloud.trigger.dev/account/tokens` — distinct from
  the per-environment `TRIGGER_SECRET_KEY` runtime secret), stored as a GitHub Actions secret on
  the repo. Alongside Vercel's own GitHub-integration deploy of the Next.js app, per
  `workflows/architecture-communication.md` §6, this means every push to `main` now deploys both
  sides automatically with no manual `npm run trigger:deploy` step.
- **Usage tracking**: populate `usage_records` per newscast (provider costs/durations as available).

## Key files/interfaces to create

- Updated `supabase/migrations/000N_rls_hardening.sql`
- `src/lib/rate-limit.ts`
- `src/lib/observability/sentry.ts`, `src/lib/observability/posthog.ts`, `src/lib/observability/logger.ts`
- `.github/workflows/deploy-trigger.yml`

## Out of scope

- New product features — this phase hardens what Phases 1–6 already built, it does not extend
  scope (spec's `IMPLEMENTATION PRIORITY` section).

## Definition of Done

Universal checklist from `00-overview.md`, plus the full spec's `FINAL ACCEPTANCE TEST`
(steps 1–12) passing end-to-end in production, including:

- Step 10: a deliberately induced failure (e.g. a bad topic that fails extraction) surfaces a
  clear error in the UI and leaves `newscasts.status = 'failed'` with a stored message.
- A push to `main` results in both a new Vercel deployment and, if `src/trigger/**` changed, a
  new Trigger.dev deployment — verify both dashboards show the new version.
- RLS policies verified by attempting (and being denied) access to another user's newscast.
