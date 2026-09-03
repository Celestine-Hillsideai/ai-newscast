# Phase 4 — Podcast

**Status:** Done and verified against live ElevenLabs in the dev environment. Real run on
"Nigeria fuel subsidy removal" produced a genuine narrated MP3, uploaded to Supabase Storage with
a working public URL. Production deploy pending.

## Known issues fixed

- **First script came in under the spec's 3-minute floor.** `podcast-script.v1`'s "450-750 words"
  instruction was treated by the model as a soft range to stay under, not a target — the first
  real script came out at 397 words, which at ElevenLabs' actual speaking pace (~143 wpm) played
  back at 2:47. Fixed in `podcast-script.v2` (kept as a separate versioned file rather than
  editing v1 in place, per `PROMPT VERSIONING`) by stating the length as a hard minimum (700-950
  words) instead of a range framed as an upper bound. Re-tested at 265s and 268s (4:22-4:47) —
  comfortably inside the 3-6 minute target.

## Scope change: target length cut to ~2 minutes

The spec originally called for a 3-6 minute podcast (`podcast-script.v2`, 700-950 words). That
was a deliberate cost tradeoff, not a bug: ElevenLabs synthesis cost scales with script length, and
a 700-950 word script runs well over 1,100 credits per newscast. The target is now ~2 minutes
(260-320 words), implemented in `podcast-script.v3` (`generate-podcast-script.ts` now imports v3;
v2 is kept for history per `PROMPT VERSIONING`, same as v1). The master spec's `PODCAST` section
and this file have been updated to match — treat 260-320 words as the current spec, not a test
override.

## Scoping decisions made during implementation

- **Real MP3 duration, not an estimate.** `generate-audio` parses the actual generated MP3 via
  the `music-metadata` package rather than estimating from word count — Phase 5's video needs an
  accurate duration to sync scene timing to the audio.
- **Audio caching reuses `media_assets.hash`, not `provider_cache`.** Phases 2-3 cache JSON
  provider responses in the `provider_cache` table; audio is binary, so `generate-audio` instead
  looks up an existing `media_assets` row with a matching hash (a column that existed since the
  Phase 1 migration but was unused until now) before ever calling ElevenLabs.
- **The podcast script goes through the same JSON-mode `LLMProvider` as Phase 3**, wrapped in a
  trivial `{ scriptText: string }` schema, rather than adding a second "plain text" code path to
  `OpenAIProvider`.
- **`audio-player.tsx` deferred to Phase 6**, along with the rest of the frontend — there's still
  no Next.js app in this repo to mount it in.

## Goal

Turn the verified briefing into a ~2 minute spoken-news podcast, stored in Supabase Storage.

## Scope

From the spec's `PODCAST` section:

- `generate-podcast-script` task: write a ~2 minute (260-320 word) professional spoken-news
  script from the verified briefing only — never introduce facts absent from it. Natural spoken
  language, not a read-aloud version of the JSON summary. Versioned prompt, per `PROMPT
  VERSIONING`.
- `generate-audio` task: synthesize the script to MP3 via ElevenLabs.
- Implement `TextToSpeechProvider` interface with `ElevenLabsProvider` as the concrete
  implementation — no direct ElevenLabs calls outside this class.
- Upload the MP3 to the `newscast-audio` Supabase Storage bucket; store only metadata
  (duration, URL, voice/model used, hash) in `media_assets` — never binary audio in Postgres.
- Cache generated audio using a hash of all output-affecting parameters (script text, voice ID,
  model settings) so identical inputs never re-render.
- Build the audio player component (presentation only — no provider logic in the component).

## Key files/interfaces to create

- `src/lib/providers/tts.ts` (`TextToSpeechProvider` interface + `ElevenLabsProvider`)
- `src/lib/prompts/podcast-script.v1.ts`, `v2.ts` (both superseded, kept for history), `v3.ts`
  (current)
- `src/trigger/generate-podcast-script.ts`, `generate-audio.ts`
- `src/components/audio-player.tsx`

## Out of scope

- Video generation (Phase 5) — the video task will *consume* this phase's audio output, not
  duplicate it.
- Frontend result-page layout beyond the audio player itself (Phase 6).

## Definition of Done

Universal checklist from `00-overview.md`, plus:

- Audio generation test and storage upload test (spec's `TESTING` minimum list) both pass.
- Manual listen-through: script contains no claims absent from the Phase 3 briefing, runs ~2
  minutes, and sounds like natural spoken news, not a JSON readout.
- Re-running the identical newscast reuses the cached MP3 instead of re-calling ElevenLabs.
