# Tools

This is the **T** in the WAT framework: scripts that help the agent enforce the discipline
described in `../workflows/00-overview.md` — not application source code. Application code's own
scripts (Remotion render CLI, Supabase migration runner, etc.) will be added to `package.json`
starting in Phase 1 and live alongside the app, not here.

- `check-env.mjs` — validates that required environment variables are set, grouped by which
  deployment target should hold them (Vercel client-safe, Vercel server-only, Trigger.dev-only).
  Mirrors the table in `../workflows/architecture-communication.md` §5.
- `verify-phase.mjs` — runs the universal Definition of Done checks (typecheck, lint, test) from
  `../workflows/00-overview.md`. Safe to run before Phase 1 exists; it will say so and exit 0.

Both scripts are plain Node ESM with no dependencies, so they run today, before `package.json`
or `npm install` exist.
