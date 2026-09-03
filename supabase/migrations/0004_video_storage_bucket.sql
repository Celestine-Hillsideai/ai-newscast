-- AI NewsCast — video storage bucket (Phase 5)
-- Same reasoning as the Phase 4 audio bucket migration: public read is fine
-- (public news broadcasts, not private data), writes go through the
-- service-role key which bypasses RLS by design.

insert into storage.buckets (id, name, public)
values ('newscast-video', 'newscast-video', true)
on conflict (id) do nothing;
