-- AcquiraIQ authenticated workspace schema
-- Run this once in the Supabase SQL editor for your project.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.saved_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null default gen_random_uuid()::text,
  record_type text not null default 'Deal',
  name text not null,
  title text,
  copy text,
  strategy text,
  scenario text,
  route text,
  notes text,
  inputs jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table if not exists public.pipeline_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null default gen_random_uuid()::text,
  source_deal_id text,
  title text not null,
  stage text not null default 'Lead',
  strategy text,
  asking_price numeric,
  source text,
  notes text,
  monthly_profit numeric,
  yield numeric,
  date_added timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table if not exists public.portfolio_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null default gen_random_uuid()::text,
  source_deal_id text,
  name text not null,
  purchase_price numeric,
  current_value numeric,
  monthly_rent numeric,
  mortgage_balance numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table if not exists public.investor_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null default gen_random_uuid()::text,
  name text not null,
  role text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

drop trigger if exists set_saved_deals_updated_at on public.saved_deals;
create trigger set_saved_deals_updated_at
before update on public.saved_deals
for each row execute function public.set_updated_at();

drop trigger if exists set_pipeline_items_updated_at on public.pipeline_items;
create trigger set_pipeline_items_updated_at
before update on public.pipeline_items
for each row execute function public.set_updated_at();

drop trigger if exists set_portfolio_properties_updated_at on public.portfolio_properties;
create trigger set_portfolio_properties_updated_at
before update on public.portfolio_properties
for each row execute function public.set_updated_at();

drop trigger if exists set_investor_contacts_updated_at on public.investor_contacts;
create trigger set_investor_contacts_updated_at
before update on public.investor_contacts
for each row execute function public.set_updated_at();

alter table public.saved_deals enable row level security;
alter table public.pipeline_items enable row level security;
alter table public.portfolio_properties enable row level security;
alter table public.investor_contacts enable row level security;

drop policy if exists "Users can read their own saved deals" on public.saved_deals;
create policy "Users can read their own saved deals"
on public.saved_deals for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their own saved deals" on public.saved_deals;
create policy "Users can create their own saved deals"
on public.saved_deals for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own saved deals" on public.saved_deals;
create policy "Users can update their own saved deals"
on public.saved_deals for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own saved deals" on public.saved_deals;
create policy "Users can delete their own saved deals"
on public.saved_deals for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read their own pipeline items" on public.pipeline_items;
create policy "Users can read their own pipeline items"
on public.pipeline_items for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their own pipeline items" on public.pipeline_items;
create policy "Users can create their own pipeline items"
on public.pipeline_items for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own pipeline items" on public.pipeline_items;
create policy "Users can update their own pipeline items"
on public.pipeline_items for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own pipeline items" on public.pipeline_items;
create policy "Users can delete their own pipeline items"
on public.pipeline_items for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read their own portfolio properties" on public.portfolio_properties;
create policy "Users can read their own portfolio properties"
on public.portfolio_properties for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their own portfolio properties" on public.portfolio_properties;
create policy "Users can create their own portfolio properties"
on public.portfolio_properties for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own portfolio properties" on public.portfolio_properties;
create policy "Users can update their own portfolio properties"
on public.portfolio_properties for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own portfolio properties" on public.portfolio_properties;
create policy "Users can delete their own portfolio properties"
on public.portfolio_properties for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read their own investor contacts" on public.investor_contacts;
create policy "Users can read their own investor contacts"
on public.investor_contacts for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their own investor contacts" on public.investor_contacts;
create policy "Users can create their own investor contacts"
on public.investor_contacts for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own investor contacts" on public.investor_contacts;
create policy "Users can update their own investor contacts"
on public.investor_contacts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own investor contacts" on public.investor_contacts;
create policy "Users can delete their own investor contacts"
on public.investor_contacts for delete
using (auth.uid() = user_id);
