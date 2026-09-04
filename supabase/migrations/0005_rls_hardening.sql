-- AI NewsCast — RLS hardening (Phase 7)
--
-- Audited all seven tables' policies from migration 0001. Six of the seven
-- (profiles, news_sources, articles, media_assets, generation_events,
-- usage_records) already correctly restrict every operation to either the
-- owning user or the service role — no gaps found, no changes needed.
--
-- newscasts_insert_own was the one real gap: it checked row ownership
-- (auth.uid() = user_id) but nothing about the row's *content*. Any client
-- holding the anon key (shipped to every browser by design) could insert a
-- newscasts row with a forged status ('completed'), headline, summary, etc.
-- directly via PostgREST, entirely bypassing the DISCOVER -> ... -> PUBLISH
-- pipeline and its verification step. Only self-visible (newscasts_select_own
-- still scopes reads to auth.uid() = user_id, so this can't leak to other
-- users), but a real integrity gap: the whole point of this product is that
-- nothing reaches "completed" without going through verification.
--
-- Fixed by restricting inserts to exactly the shape POST /api/newscasts
-- actually creates (status='queued', every content column at its column
-- default). Every later transition to 'researching' -> ... -> 'completed'
-- and every content field already only ever comes from generate-newscast's
-- service-role writes (see src/lib/newscast-status.ts), which bypass RLS
-- entirely — this policy only constrains the `authenticated` role's insert.

drop policy "newscasts_insert_own" on newscasts;

create policy "newscasts_insert_own" on newscasts
  for insert with check (
    auth.uid() = user_id
    and status = 'queued'
    and error_message is null
    and trigger_run_id is null
    and headline is null
    and dek is null
    and summary is null
    and what_happened is null
    and key_developments = '[]'::jsonb
    and why_it_matters is null
    and what_we_know = '[]'::jsonb
    and what_we_do_not_know = '[]'::jsonb
    and timeline = '[]'::jsonb
    and source_ids = '[]'::jsonb
    and confidence_score is null
    and completed_at is null
  );
