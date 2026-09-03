# Phase 5 — Video

**Status:** Done and verified against both a Trigger.dev dev-mode run (2026-09-02) and a real
`prod` deploy/run (2026-09-03, version `20260903.4`). Full pipeline run on "Nigeria fuel subsidy
removal" produced a genuine 102s MP4 (synced to the 102s podcast audio), uploaded to the
`newscast-video` Supabase Storage bucket with a working public URL, and `newscasts.status` reached
`completed`. Three real infrastructure bugs were found and fixed only by testing an actual
production deploy (see "Known risks" below for each): a static-analysis blind spot that dropped
`src/remotion/**` from the deployed image, a `maxDuration` too tight for a cold container, and a
default machine size too small for Remotion's `bundle()` + Chromium rendering. The Chrome Headless
Shell is now baked into the image at build time rather than downloaded lazily at runtime, which
cut `generate-video`'s wall-clock time from ~9.5 minutes (dev-mode, cold download) to 2m30s
(prod, pre-baked + right-sized machine).

## Research and scoping decisions made during implementation

This phase carried more infrastructure risk than Phases 1-4 (headless Chromium rendering inside
Trigger.dev's Docker build, first React/JSX code in the repo), so the Remotion Agent Skills
(`npx skills add remotion-dev/skills`) and Remotion's own docs (fetched live via the
`remotion-docs` skill's Algolia+`.md` workflow) were used to verify the integration before writing
code, rather than relying on assumption — the same lesson as Phase 1's WebSocket bug.

- **`aptGet` build extension for Chromium's Linux deps.** Trigger.dev's `@trigger.dev/build/extensions/core`
  exposes a generic `aptGet({ packages: [...] })` extension; used in `trigger.config.ts` with the
  Debian package list from Remotion's Linux Dependencies doc (Trigger.dev's build image is Debian
  Bookworm, so plain `libasound2`, not Ubuntu 24.04's `libasound2t64`).
- **Chrome Headless Shell downloads lazily, not via postinstall.** Confirmed by inspecting
  `node_modules/@remotion` after install — no browser binary is fetched at `npm install` time
  (only `@remotion/compositor-<platform>` native modules are). It downloads on first actual
  render call instead, which sidesteps a real local risk (this machine's npm showed an
  `allow-scripts` gate on some packages' postinstall scripts) but means a deployed Trigger.dev
  container's *first* video render will be slower than subsequent ones (browser download +
  cache), which is expected behavior, not a bug, if seen.
- **`bundle()` is called once per container lifetime, at task runtime, not at Trigger.dev's build
  time.** Remotion's docs explicitly warn against calling `bundle()` inside code that has itself
  been bundled (e.g. a Next.js serverless function) — but that failure mode is about *aggressive
  dependency-inlining* bundlers (tracing and inlining every transitive `node_modules` dependency
  into one self-contained artifact), which Trigger.dev's esbuild step does not do (it ships a real
  `node_modules` in the image and only bundles the task's own source). Calling `bundle()` at
  runtime in a long-running Node process is Remotion's own documented recommendation for this
  case ("Rendering in Node.js"). `RemotionVideoProvider` caches the bundle in a module-level
  variable so it only actually re-bundles once per container, not per render.
- **`calculateMetadata` syncs video length to the real audio duration** already known from Phase
  4 (`durationSeconds`) — no re-parsing of the audio file inside the Remotion composition.
- **`sourceNames` resolved by the task, not the Remotion component** — `generate-video.ts` queries
  `articles` → `news_sources` once and passes plain strings into the composition, keeping
  data-fetching out of the render tier entirely.
- **Thumbnails/`newscast-images` bucket deferred** — not yet used by anything; adding an unused
  bucket now would be premature.
- **`video-player.tsx` deferred to Phase 6** along with the rest of the frontend, same as Phase
  4's audio player.

## Known risks not yet resolved by testing

- **Correction to an earlier assumption**: dev-mode testing on this Windows machine *does*
  exercise the lazy Chrome Headless Shell download (it fetched the win64 build on first
  `generate-video` call, same lazy-download code path as production) — the earlier note that
  Windows dev-mode "doesn't exercise this path at all" was wrong.
- On a slow/unstable connection, the first-ever Chrome Headless Shell download can stall mid-way
  and fail the `generate-video` task (observed once during testing — a ~113MB download that
  timed out partway through). Pre-warming the cache via `@remotion/renderer`'s `ensureBrowser()`
  before running a test avoids this; it is a one-time cost per machine/container, not a
  per-render cost.
- **Resolved 2026-09-02**: `npm run trigger:deploy` was run against the `prod` environment
  (version `20260902.4`, 10 tasks). The `aptGet` Chromium dependency list installed cleanly on
  Trigger.dev's Debian Bookworm build image for both the `build` and `base` Docker stages — no
  missing packages, no version conflicts. This confirms the package list in `trigger.config.ts`
  is correct for their real build environment, not just plausible from reading Remotion's docs.
  **Still open**: the Linux Chrome Headless Shell binary's lazy download only happens on a
  container's first actual `generate-video` execution, which deploying the image does not
  trigger — a real production run has not yet been exercised. If a first production run stalls
  the same way the local Windows one did, `generate-video`'s task-level retries (per
  `trigger.config.ts`) will retry the whole download rather than resuming it.
- **Found and fixed 2026-09-02**: the first real production `generate-video` run failed with
  `ENOENT: no such file or directory, open '/app/src/remotion/index.ts'`. Root cause:
  `RemotionVideoProvider` (`src/lib/providers/video.ts`) passes `@remotion/bundler`'s `bundle()` a
  runtime file path (`path.join(process.cwd(), "src", "remotion", "index.ts")`), not a static
  `import` — Trigger.dev's build only ships files it can detect via static import analysis, so
  `src/remotion/**` was silently absent from the deployed image even though `dirs` correctly
  pointed at `src/trigger`. Fixed by adding the `additionalFiles({ files: ["src/remotion/**/*"] })`
  build extension in `trigger.config.ts`, which explicitly ships that directory. Not caught by
  dev-mode testing because `trigger dev` runs directly against the full local repo, where
  `process.cwd()` always has the complete `src/` tree — this class of bug (a runtime-resolved path
  Trigger.dev's static bundler can't see) can only surface on a real deploy.
- **Found and fixed 2026-09-03**: the next production run (version `20260902.5`, ENOENT fix
  deployed) failed with `MAX_DURATION_EXCEEDED: Run exceeded maximum compute time (maxDuration)
  of 600 seconds`. Root cause: `trigger.config.ts`'s global `maxDuration: 600` (10 min) was
  already razor-thin for `generate-video` even under ideal conditions — a local test with the
  Chrome Headless Shell *already cached* still took 9m37s for `bundle()` + render alone. In a
  fresh production container paying for both a cold `bundle()` call and (if not yet cached) the
  Chrome Headless Shell download in the same run, 600s isn't enough. Fixed by raising
  `maxDuration` to 1800 (30 min). This is a global config value (applies to every task, not just
  `generate-video`); if per-task limits become worth the complexity later, Trigger.dev supports
  overriding `maxDuration` per task definition instead of only globally.
- **Implemented and verified 2026-09-03** (version `20260903.3`): the Chrome Headless Shell is
  now baked into the Docker image at *build* time via a custom `prewarmRemotionChrome()` build
  extension in `trigger.config.ts`, removing the cold-start download tax entirely instead of just
  giving it more time (the `maxDuration` bump above). Verified by reading the CLI's own source
  (`node_modules/trigger.dev/dist/esm/deploy/buildImage.js` and `.../build/extensions.js`) rather
  than assuming: a `BuildLayer.commands` entry becomes a `RUN` step inserted after `npm i` and
  after `COPY . .` in the `build` stage, so `@remotion/renderer` is already require()-able: the
  extension runs `node -e "require('@remotion/renderer').ensureBrowser()..."` there.
  `@remotion/renderer` resolves its download cache to `<project-root>/node_modules/.remotion`
  (`getDownloadsCacheDir()` in `@remotion/renderer/dist/esm/index.mjs`), which is inside
  `node_modules` — and the Dockerfile's final stage already does
  `COPY --from=build .../node_modules ./node_modules`, so the downloaded binary ships in the
  final image with no other change needed. Confirmed live in the deploy log: the ~92MB download
  completed in ~2 seconds on Trigger.dev's build infrastructure (vs. minutes-to-stalling on this
  machine's connection) and printed "Chrome Headless Shell pre-cached" before the build
  continued normally. `ensureBrowser()` only checks a version-marker file and downloads if
  missing, so it doesn't need the `aptGet` Chromium shared libs at build time — those are baked
  into the `base` image the `build` stage extends from regardless, so they're present at actual
  render time either way.
- **Found and fixed 2026-09-03**: the next production run (version `20260903.3`, browser
  pre-baked) got past the download entirely (confirmed: `generating_video` progressed for ~6
  minutes, well past where a download would have started) but then failed with
  `TASK_PROCESS_OOM_KILLED: Run was terminated due to running out of memory`. Root cause: Remotion's
  `bundle()` (webpack/rspack) plus headless Chromium rendering are both memory-hungry, and
  Trigger.dev's default machine preset doesn't have enough RAM for them. Fixed by adding
  `machine: "large-1x"` to the `generate-video` task definition only (`src/trigger/generate-video.ts`)
  — scoped per-task via the SDK's `task()` options, not raised globally, since every other task in
  the pipeline is lightweight and doesn't need (or should pay for) a bigger machine.

## Goal

Produce a programmatic news video from the same verified briefing and podcast audio — no
generative video for the MVP.

## Scope

From the spec's `VIDEO` section:

- `generate-video` task: render via Remotion, composing seven scenes in order — Intro, Headline,
  Key developments, Timeline, Why it matters, Sources, Outro — as reusable React-based news
  graphics with consistent visual branding.
- The rendered video must include the Phase 4 podcast audio as its soundtrack.
- Implement `VideoRenderer` interface with `RemotionVideoProvider` as the concrete
  implementation.
- Upload the rendered MP4 to the `newscast-video` bucket (and any generated stills/thumbnails to
  `newscast-images`/`newscast-thumbnails`); store only metadata in `media_assets`.
- Cache rendered video using a hash of all output-affecting parameters (summary content, audio
  hash, scene/template version) so identical inputs never re-render.
- Build the video player component (presentation only).

## Key files/interfaces to create

- `src/lib/providers/video.ts` (`VideoRenderer` interface + `RemotionVideoProvider`)
- `src/remotion/` (composition + one file per scene: Intro, Headline, KeyDevelopments, Timeline, WhyItMatters, Sources, Outro)
- `src/trigger/generate-video.ts`
- `src/components/video-player.tsx`

## Out of scope

- Any AI-generated video/imagery — explicitly forbidden for the MVP by the spec.
- Frontend result-page layout beyond the video player itself (Phase 6).

## Definition of Done

Universal checklist from `00-overview.md`, plus:

- Manual watch-through: all seven scenes appear in order, audio is present and in sync, branding
  is consistent across scenes.
- Re-running the identical newscast reuses the cached MP4 instead of re-rendering.
- Render time and failure modes are acceptable for the Trigger.dev task's time limits (validate
  before moving on — Remotion renders are the most likely long-pole/failure point in the whole
  pipeline).
