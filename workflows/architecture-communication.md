# Architecture: how the Vercel frontend and the Trigger.dev backend communicate

Single repo, two deployment targets:

- **Frontend** — the Next.js app, deployed to **Vercel**, connected via **GitHub** (push to `main`
  triggers a Vercel build/deploy through its GitHub integration).
- **Backend** — the tasks under `src/trigger/`, deployed independently to **Trigger.dev** via
  `npx trigger.dev@latest deploy` (wired into CI in Phase 7).

They never call each other's private APIs directly. They communicate through three channels:
Supabase (shared state), the Trigger.dev SDK (server-to-server trigger), and Trigger.dev Realtime
(server-to-browser progress, scoped by a public token).

## 1. Kicking off a run (browser → Vercel → Trigger.dev)

```
Browser                Vercel (Next.js API route)              Trigger.dev
  |  POST /api/newscasts        |                                    |
  |  { topic }                  |                                    |
  |----------------------------->|                                   |
  |                              | 1. Zod-validate topic (3–200 ch)  |
  |                              | 2. INSERT newscasts (status=queued)|
  |                              |    into Supabase                  |
  |                              | 3. tasks.trigger("generate-newscast",|
  |                              |    payload) using TRIGGER_SECRET_KEY|
  |                              |------------------------------------>|
  |                              |<------------------------------------|
  |                              | 4. mint publicAccessToken for runId |
  |  { success, newscastId,      |                                    |
  |    runId, publicAccessToken }|                                    |
  |<-----------------------------|                                    |
```

This is exactly the spec's `POST /api/newscasts` contract. `TRIGGER_SECRET_KEY` is a server-only
Vercel env var — it is read inside the API route (Node runtime) and is never part of the client
JS bundle.

## 2. Live progress (browser → Trigger.dev, direct — no polling)

Once the browser has `runId` + `publicAccessToken`, the Generation page uses
`@trigger.dev/react-hooks`'s `useRealtimeRun(runId, { accessToken: publicAccessToken })` to
subscribe **directly** to Trigger.dev's realtime endpoint. Vercel is not in this path at all.
The token is scoped to that single run, so it's safe to hand to the browser.

Each task in the chain (`discover-news` → `extract-articles` → `deduplicate-news` →
`verify-news` → `summarize-news` → `generate-podcast-script` → `generate-audio` →
`generate-video` → `finalize-newscast`) calls `metadata.set("stage", ...)` /
`metadata.set("progress", ...)` as it works, so the realtime hook reflects the exact stage names
from the spec's `FRONTEND UX STATES` list (`queued`, `researching`, `extracting`, ...).

## 3. Progress persistence (Trigger.dev → Supabase)

The realtime channel is ephemeral — it's for the page that's open right now. Durable state lives
in Supabase. Every task, after updating Realtime metadata, also:

- Updates `newscasts.status` to the current stage.
- Appends a row to `generation_events` (newscastId, stage, provider, duration, status, error).

This uses `SUPABASE_SERVICE_ROLE_KEY`, which lives **only** in the Trigger.dev dashboard's
environment variables for this project — it is never set in Vercel, and never shipped to the
browser. This dual-write (Realtime + Supabase) is what makes acceptance criterion #9 work:
refreshing the page loses the realtime subscription but the Result/History pages still show the
correct state because it was persisted.

## 4. Reading results and history (browser → Vercel → Supabase)

The Result and History pages do not talk to Supabase from the browser. They call typed Next.js
API routes:

- `GET /api/newscasts/:id` — one newscast with its articles, sources, media asset URLs.
- `GET /api/newscasts` — the current user's newscast history.

These routes run server-side on Vercel, authenticate the caller via the Supabase Auth session
cookie, query Postgres (RLS still applies — the route uses the user's session, not the service
role key, for reads), and return typed JSON. This keeps one consistent boundary — "frontend talks
to typed Next.js API routes, never to a provider or the database directly" — rather than mixing
direct-Supabase-from-browser calls with API-route calls.

## 5. Where each secret lives

| Variable | Vercel (frontend project) | Trigger.dev (backend project) | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ (if tasks also read via anon client) | Public by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | — | Public by design, RLS-protected |
| `SUPABASE_SERVICE_ROLE_KEY` | — | ✅ | Server/task-only, full DB bypass — never in Vercel |
| `TRIGGER_SECRET_KEY` | ✅ (server-only, used inside API routes) | — | Lets Vercel *trigger* runs AND mint the per-run `publicAccessToken` (`auth.createPublicToken`) that the browser uses for `useRealtimeRun` — no separate public/client key exists or is needed |
| `TAVILY_API_KEY` | — | ✅ | Task-only provider secret |
| `FIRECRAWL_API_KEY` | — | ✅ | Task-only provider secret |
| `OPENAI_API_KEY` | — | ✅ | Task-only provider secret |
| `ELEVENLABS_API_KEY` | — | ✅ | Task-only provider secret |
| `SENTRY_DSN` | ✅ | ✅ | Both sides report errors to the same Sentry project |
| `NEXT_PUBLIC_POSTHOG_KEY` | ✅ | — | Client-side analytics only |

The authoritative, checkable version of this table is `tools/check-env.mjs`.

## 6. Deployment sequencing

1. Push to `main` on GitHub.
2. Vercel's GitHub integration builds and deploys the Next.js app automatically.
3. A GitHub Actions job (added in Phase 7) runs `npx trigger.dev@latest deploy` for anything
   changed under `src/trigger/**`, so backend tasks stay in sync with the same commit.
4. Because both deployments read from the same repo and the same Supabase schema, there is no
   versioning drift between the API contract the frontend expects and the payload shape the
   tasks produce — that contract is defined once, in Zod schemas under `src/lib/schemas/`
   (created in Phase 1), imported by both the API routes and the tasks.
