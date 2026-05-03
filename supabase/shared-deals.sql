-- Deprecated: use supabase/deals.sql instead (main shareable entity is public.deals).
-- Run in Supabase SQL editor (once).
-- Private-by-link: no public index in the app; UUID acts as an unguessable capability token.

create extension if not exists "pgcrypto";

create table if not exists public.shared_deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  engine text not null,
  category text not null,
  asking_price numeric not null,
  listing_url text,
  listing_description text,
  result_json jsonb not null,
  media_photo_url text,
  media_video_url text
);

create table if not exists public.deal_comments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.shared_deals (id) on delete cascade,
  created_at timestamptz not null default now(),
  verdict text not null check (verdict in ('DEAL', 'NEGOTIATE', 'WALK_AWAY')),
  reason text not null,
  suggested_price numeric
);

create index if not exists deal_comments_deal_id_idx on public.deal_comments (deal_id);

alter table public.shared_deals enable row level security;
alter table public.deal_comments enable row level security;

-- MVP: anon key can create/read deals & comments (security via secret UUID in URL).
drop policy if exists "shared_deals_select" on public.shared_deals;
create policy "shared_deals_select" on public.shared_deals for select using (true);

drop policy if exists "shared_deals_insert" on public.shared_deals;
create policy "shared_deals_insert" on public.shared_deals for insert with check (true);

drop policy if exists "deal_comments_select" on public.deal_comments;
create policy "deal_comments_select" on public.deal_comments for select using (true);

drop policy if exists "deal_comments_insert" on public.deal_comments;
create policy "deal_comments_insert" on public.deal_comments for insert with check (true);

-- Optional: Storage bucket for photos/videos (create bucket "deal-media" as PUBLIC in Dashboard,
-- then run:)
-- Storage policies may still require service role for uploads from API; set SUPABASE_SERVICE_ROLE_KEY in Next.js.
