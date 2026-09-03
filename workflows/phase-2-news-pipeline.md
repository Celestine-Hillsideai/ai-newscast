# Phase 2 — News pipeline

**Status:** Done and verified against live Tavily/Firecrawl in both dev and Trigger.dev
production. A real run on topic "Nigeria fuel subsidy removal" discovered 19 candidate URLs,
extracted 18/19 real articles (Punch, Guardian, Daily Trust, Nairametrics, and others; one
genuine rejection — empty content, likely JS-rendered/paywalled, not a rate limit), deduplicated
them, and the orchestrator completed end-to-end. Deployed as production version `20260902.1`
(deploy `spe5rown`) and smoke-tested successfully — same result counts, since `provider_cache` is
one shared table across dev and prod (both point at the same Supabase project), so the prod run
reused dev's cached Tavily/Firecrawl results for the identical topic rather than re-fetching.

## Known issues fixed

- **Firecrawl 429s were being treated as permanent rejections.** The first live test run (19
  attempts) hit Firecrawl's free-tier per-minute rate limit and only extracted 9/19 articles,
  discarding the other 10 as "rejected" instead of retrying — a real gap against the spec's
  `ERROR HANDLING` section, which explicitly requires retrying 429/500/502/503/504. Fixed by
  adding `src/lib/http-retry.ts` (`fetchWithRetry`, exponential backoff, 4 attempts) and using it
  in both `TavilySearchProvider` and `FirecrawlArticleProvider`. Re-running the identical topic
  afterward extracted 18/19.

## Scoping decisions made during implementation

- **Dedup layer 4 (LLM event clustering) deferred to Phase 3.** Layers 1-3 (URL normalization,
  content hashing, lexical title similarity) are fully implemented; layer 4
  (`src/lib/dedup/llm-clustering.ts`) is a wired-but-inert passthrough until Phase 3 introduces
  `LLMProvider`/`OpenAIProvider`, so this phase needs only Tavily + Firecrawl keys.
- **Semantic similarity is lexical, not embedding-based.** `src/lib/dedup/semantic-similarity.ts`
  uses token-set Jaccard similarity as a cheap stand-in for "semantic similarity" — no LLM call,
  no extra API key. Upgrading to embeddings is a drop-in replacement once Phase 3 exists (same
  call site in `deduplicate-news.ts`).
- **Two Tavily queries per topic, not one per source.** `discover-news` runs one call scoped to
  all enabled `news_sources` domains via `include_domains`, plus one broader unscoped call —
  satisfies the spec's "multiple queries" + "source-specific" requirements without ~15x the API
  calls a per-source loop would cost.
- **Every extraction attempt is persisted, not just accepted ones.** `articles.status` is now
  actually used: `'extracted'` (accepted), `'rejected'` (Firecrawl failed or content too short,
  with `rejection_reason` set), `'duplicate'` (removed by `deduplicate-news`, `rejection_reason`
  set to `duplicate_of:<representative-id>`). Useful for debugging why a run's source count looks
  low.
- **Caching added a new table**, `provider_cache` (migration `0002`) — generic
  key/value cache keyed by a deterministic SHA-256 hash (`src/lib/cache.ts`), used per-topic in
  `discover-news` and per-URL in `extract-articles` (so the same article is never re-scraped
  across different newscasts).

## Goal

Given a topic, actually discover and extract real, deduplicated Nigerian news articles.

## Scope

From the spec's `NEWS PROCESSING`, `DEDUPLICATION`, and `NEWS SOURCES` sections:

- `discover-news` task: search multiple queries per topic via Tavily, including source-specific
  queries against the `news_sources` registry. Normalize URLs, remove duplicate URLs.
- `extract-articles` task: extract full article content via Firecrawl for each discovered URL.
  Reject unusable extraction results (empty/too-short/paywalled).
- `deduplicate-news` task: implement all four layers from the spec, in order —
  1. URL normalization, 2. content/title hashing, 3. semantic similarity, 4. LLM event
  clustering where the first three are insufficient.
- Implement `NewsSearchProvider` and `ArticleExtractionProvider` interfaces (per
  `PROVIDER ABSTRACTION`) with `TavilySearchProvider` and `FirecrawlArticleProvider` as the first
  concrete implementations — no direct Tavily/Firecrawl calls anywhere outside these two classes.
- Wire `generate-newscast` (the master orchestrator) to call discover → extract → deduplicate in
  sequence, updating `newscasts.status` and `generation_events` after each stage per
  `workflows/architecture-communication.md` section 3.
- Implement caching for search results and extracted articles using deterministic hashes (spec's
  `CACHING` section) — never re-fetch/re-extract identical inputs.

## Key files/interfaces to create

- `src/lib/providers/news-search.ts` (`NewsSearchProvider` interface + `TavilySearchProvider`)
- `src/lib/providers/article-extraction.ts` (`ArticleExtractionProvider` interface + `FirecrawlArticleProvider`)
- `src/lib/dedup/` (url-normalize.ts, content-hash.ts, semantic-similarity.ts, llm-clustering.ts)
- `src/trigger/discover-news.ts`, `extract-articles.ts`, `deduplicate-news.ts` (real implementations replacing Phase 1 stubs)

## Out of scope

- Verification, summarization (Phase 3).
- Any audio/video generation (Phases 4–5).
- Frontend display of discovered articles beyond raw counts for the progress UI (Phase 6).

## Definition of Done

Universal checklist from `00-overview.md`, plus:

- Unit tests for URL normalization and duplicate detection (spec's `TESTING` minimum list).
- A manual run against at least one real Nigerian breaking-news topic produces a deduplicated
  article set with no obvious duplicate stories.
- Cache hit on a second run with the identical topic (verify via `generation_events` or logs —
  no duplicate Tavily/Firecrawl calls for identical inputs).
