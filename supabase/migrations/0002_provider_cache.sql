-- AI NewsCast — generic provider-response cache (Phase 2)
-- Backs src/lib/cache.ts. Keyed by a deterministic hash of the inputs that
-- affect a provider call's output (see spec's CACHING section: "Never
-- regenerate identical expensive assets unnecessarily"). Not user-facing
-- data, so RLS is enabled with no policies — only the service role (used by
-- Trigger.dev tasks) can read or write it.

create table provider_cache (
  cache_key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now()
);

alter table provider_cache enable row level security;
