# Phase 3 — Verification & structured summary

**Status:** Done and verified against live OpenAI in the dev environment. Real run on "Nigeria
fuel subsidy removal": `verify-news` (14.1s) and `summarize-news` (9.4s) both succeeded, and the
2-source rule demonstrably did real work — two specific figures from Phase 2's article set
("saves N10 trillion annually", "N3.5 trillion spent on imports") were each reported by only one
Nairametrics article and correctly ended up in `whatWeDoNotKnow` as unverified, while the two
multi-sourced facts (the subsidy removal announcement and the resulting price increase) landed in
`whatWeKnow`. Full `NEWS SUMMARY` field set persisted to the `newscasts` row (headline through
confidenceScore, 18 sourceIds). `generation_events.metadata` correctly records
`{ promptVersion }` for both stages. Production deploy pending.

## Scoping decisions made during implementation

- **Verification is code-enforced, not prompt-only.** The LLM proposes each claim's supporting
  article ids and its own confirmed/conflicting/unverified guess; `src/trigger/verify-news.ts`
  independently re-checks that any "confirmed" claim has 2+ distinct `source_id`s behind it,
  downgrading it to unverified otherwise — the spec's corroboration rule is an enforced invariant,
  not just a prompt instruction a model could ignore.
- **`sourceIds` is computed in code, not asked of the LLM**, in `summarize-news.ts` — it's just
  the deduped article ids already known from the orchestrator, avoiding any risk of the model
  hallucinating ids.
- **Dedup layer 4 remains deferred** — `src/lib/dedup/llm-clustering.ts` is unchanged, still an
  inert passthrough, even though `LLMProvider` now exists. Revisit only if a real run is observed
  missing a duplicate that layers 1-3 should have caught.
- **Prompt versions are recorded per-run**, not just in code: `generation_events.metadata` now
  carries `{ promptVersion }` for both stages (the column existed since Phase 1's migration but
  was unused until now).

## Goal

Turn a deduplicated article set into a verified, structured editorial briefing — the editorial
safeguard that stops raw web results from ever reaching the video/audio stages unchecked.

## Scope

From the spec's `VERIFICATION` and `NEWS SUMMARY` sections:

- `verify-news` task: dedicated verification stage producing confirmed facts, conflicting
  claims, unverified claims, a timeline, and a confidence score. A claim is only "confirmed" with
  corroboration from independent credible sources — never on a single low-quality source.
- `summarize-news` task: produce the structured JSON summary — `headline`, `dek`, `summary`,
  `whatHappened`, `keyDevelopments`, `whyItMatters`, `whatWeKnow`, `whatWeDoNotKnow`, `timeline`,
  `sourceIds`, `confidenceScore` — validated with Zod. Reject and retry (or fail the run with an
  actionable error) on schema validation failure.
- Implement `LLMProvider` interface (per `PROVIDER ABSTRACTION`) with `OpenAIProvider` as the
  concrete implementation — no direct OpenAI calls outside this class.
- Version every prompt used here (spec's `PROMPT VERSIONING`) and store the prompt version in
  `generation_events`/summary metadata.
- Implement caching for summaries keyed on a deterministic hash of the verified input.

## Key files/interfaces to create

- `src/lib/providers/llm.ts` (`LLMProvider` interface + `OpenAIProvider`)
- `src/lib/schemas/summary.ts` (Zod schema for the structured summary)
- `src/lib/prompts/verify-news.v1.ts`, `src/lib/prompts/summarize-news.v1.ts` (versioned prompts)
- `src/trigger/verify-news.ts`, `summarize-news.ts` (real implementations)

## Out of scope

- Podcast script writing (that's a distinct step in Phase 4, even though it also uses the LLM
  provider — don't fold it into this phase).
- Audio/video generation.

## Definition of Done

Universal checklist from `00-overview.md`, plus:

- LLM schema validation test (spec's `TESTING` minimum list): a malformed model response is
  caught by Zod, not silently passed through.
- Manual check: feed a topic with genuinely conflicting reports across sources and confirm the
  verifier surfaces the conflict rather than picking one side silently.
- Manual check: a claim reported by only one low-trust source is classified as unverified, not
  confirmed.
