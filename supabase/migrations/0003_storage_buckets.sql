-- AI NewsCast — storage buckets (Phase 4)
-- Public read is appropriate: these are public news broadcasts, not private
-- data. Public buckets serve reads without needing storage.objects RLS
-- policies; writes go through the service-role key (as every Trigger.dev
-- task already does), which bypasses RLS by design, so no additional policy
-- is needed here.

insert into storage.buckets (id, name, public)
values ('newscast-audio', 'newscast-audio', true)
on conflict (id) do nothing;
