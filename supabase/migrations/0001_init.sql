-- AI NewsCast — initial schema (Phase 1)
-- Creates the seven tables from the master spec's DATABASE section, enables
-- RLS on all of them, and seeds the initial news_sources registry.
--
-- Apply this in the Supabase SQL editor (or `supabase db push` if the CLI is
-- linked to your project). RLS policies here are a first pass — see
-- workflows/phase-7-hardening.md for full hardening.

create extension if not exists "pgcrypto";

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- news_sources
-- ---------------------------------------------------------------------------
create table news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null unique,
  homepage_url text not null,
  rss_url text,
  priority integer not null default 2,
  trust_score numeric(3, 2) not null default 0.80,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table news_sources enable row level security;

create policy "news_sources_select_enabled" on news_sources
  for select using (enabled = true);

-- ---------------------------------------------------------------------------
-- newscasts
-- ---------------------------------------------------------------------------
create table newscasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null,
  status text not null default 'queued',
  error_message text,
  trigger_run_id text,
  headline text,
  dek text,
  summary text,
  what_happened text,
  key_developments jsonb not null default '[]'::jsonb,
  why_it_matters text,
  what_we_know jsonb not null default '[]'::jsonb,
  what_we_do_not_know jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  source_ids jsonb not null default '[]'::jsonb,
  confidence_score numeric(3, 2),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table newscasts enable row level security;

create policy "newscasts_select_own" on newscasts
  for select using (auth.uid() = user_id);

create policy "newscasts_insert_own" on newscasts
  for insert with check (auth.uid() = user_id);

-- No update policy for `authenticated`: status/content updates come only
-- from Trigger.dev tasks using the service-role key, which bypasses RLS.

create trigger newscasts_set_updated_at
  before update on newscasts
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- articles
-- ---------------------------------------------------------------------------
create table articles (
  id uuid primary key default gen_random_uuid(),
  newscast_id uuid not null references newscasts (id) on delete cascade,
  source_id uuid references news_sources (id),
  url text not null,
  normalized_url text not null,
  title text,
  content text,
  published_at timestamptz,
  extracted_at timestamptz,
  content_hash text,
  status text not null default 'extracted',
  rejection_reason text,
  created_at timestamptz not null default now()
);

alter table articles enable row level security;

create policy "articles_select_via_newscast" on articles
  for select using (
    exists (
      select 1 from newscasts
      where newscasts.id = articles.newscast_id
        and newscasts.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- media_assets
-- ---------------------------------------------------------------------------
create table media_assets (
  id uuid primary key default gen_random_uuid(),
  newscast_id uuid not null references newscasts (id) on delete cascade,
  type text not null check (type in ('audio', 'video', 'image', 'thumbnail')),
  bucket text not null,
  storage_path text not null,
  url text,
  duration_seconds numeric,
  mime_type text,
  hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table media_assets enable row level security;

create policy "media_assets_select_via_newscast" on media_assets
  for select using (
    exists (
      select 1 from newscasts
      where newscasts.id = media_assets.newscast_id
        and newscasts.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- generation_events
-- ---------------------------------------------------------------------------
create table generation_events (
  id uuid primary key default gen_random_uuid(),
  newscast_id uuid not null references newscasts (id) on delete cascade,
  stage text not null,
  provider text,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  duration_ms integer,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table generation_events enable row level security;

create policy "generation_events_select_via_newscast" on generation_events
  for select using (
    exists (
      select 1 from newscasts
      where newscasts.id = generation_events.newscast_id
        and newscasts.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- usage_records
-- ---------------------------------------------------------------------------
create table usage_records (
  id uuid primary key default gen_random_uuid(),
  newscast_id uuid references newscasts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  operation text not null,
  quantity numeric,
  unit text,
  cost_usd numeric(10, 4),
  created_at timestamptz not null default now()
);

alter table usage_records enable row level security;

create policy "usage_records_select_own" on usage_records
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- seed: initial news source registry (spec: NEWS SOURCES)
-- rss_url intentionally left null — not verified live in this pass.
-- ---------------------------------------------------------------------------
insert into news_sources (name, domain, homepage_url, priority, trust_score, enabled) values
  ('Premium Times', 'premiumtimesng.com', 'https://www.premiumtimesng.com', 1, 0.90, true),
  ('Punch', 'punchng.com', 'https://punchng.com', 1, 0.88, true),
  ('The Guardian Nigeria', 'guardian.ng', 'https://guardian.ng', 1, 0.88, true),
  ('Channels Television', 'channelstv.com', 'https://www.channelstv.com', 1, 0.90, true),
  ('THISDAY', 'thisdaylive.com', 'https://www.thisdaylive.com', 1, 0.85, true),
  ('Vanguard', 'vanguardngr.com', 'https://www.vanguardngr.com', 1, 0.85, true),
  ('Daily Trust', 'dailytrust.com', 'https://dailytrust.com', 2, 0.82, true),
  ('BusinessDay', 'businessday.ng', 'https://businessday.ng', 2, 0.85, true),
  ('TheCable', 'thecable.ng', 'https://www.thecable.ng', 2, 0.85, true),
  ('Leadership', 'leadership.ng', 'https://leadership.ng', 2, 0.80, true),
  ('Tribune', 'tribuneonlineng.com', 'https://tribuneonlineng.com', 2, 0.80, true),
  ('Arise News', 'arise.tv', 'https://www.arise.tv', 2, 0.82, true),
  ('TVC News', 'tvcnews.tv', 'https://www.tvcnews.tv', 2, 0.80, true),
  ('Nairametrics', 'nairametrics.com', 'https://nairametrics.com', 2, 0.83, true);
