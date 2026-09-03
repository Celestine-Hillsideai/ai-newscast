# Phase 7 — Hardening

**Status:** Not started, except the CI/CD bullet below — pulled forward to 2026-09-03 at the
user's request, once the Phase 6 generate→result loop was verified working in production. Nothing
else in this phase (auth, RLS hardening, rate limiting, Sentry, PostHog, usage tracking) has been
started.

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
