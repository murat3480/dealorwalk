-- Reference DDL aligned with app inserts (see src/lib/persistDeal.ts).
-- Run in Supabase SQL editor for new installs only—do not apply blindly if `deals` already exists.

create extension if not exists "pgcrypto";

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  share_id text not null unique,
  created_at timestamptz not null default now(),
  category text not null,
  title text not null,
  price numeric not null,
  currency text not null default 'USD',
  source_url text,
  description text,
  verdict text not null,
  deal_score int not null,
  risk_score int not null,
  fair_price_low numeric not null,
  fair_price_high numeric not null,
  explanation text not null default '',
  red_flags jsonb not null default '[]'::jsonb,
  seller_message text,
  recommended_action text,
  result_json jsonb not null,
  car_input_id uuid,
  car_result_id uuid,
  is_public boolean not null default false
);

create index if not exists deals_share_id_idx on public.deals (share_id);

-- Comments reference internal deals.id (FK); URLs use deals.share_id only.
drop table if exists public.deal_comments cascade;

create table public.deal_comments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  created_at timestamptz not null default now(),
  verdict text not null check (verdict in ('DEAL', 'NEGOTIATE', 'WALK_AWAY')),
  reason text not null,
  suggested_price numeric
);

create index if not exists deal_comments_deal_id_idx on public.deal_comments (deal_id);

alter table public.deals enable row level security;
alter table public.deal_comments enable row level security;

drop policy if exists "deals_select" on public.deals;
create policy "deals_select" on public.deals for select using (true);

drop policy if exists "deals_insert" on public.deals;
create policy "deals_insert" on public.deals for insert with check (true);

drop policy if exists "deal_comments_select" on public.deal_comments;
create policy "deal_comments_select" on public.deal_comments for select using (true);

drop policy if exists "deal_comments_insert" on public.deal_comments;
create policy "deal_comments_insert" on public.deal_comments for insert with check (true);
