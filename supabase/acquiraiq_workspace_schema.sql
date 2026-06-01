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

create table if not exists public.account_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'premium', 'pro', 'admin')),
  stripe_customer_id text,
  subscription_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_profiles
drop constraint if exists account_profiles_plan_check;

alter table public.account_profiles
add constraint account_profiles_plan_check
check (plan in ('free', 'premium', 'pro', 'admin'));

update public.account_profiles
set plan = lower(plan)
where plan in ('Free', 'Premium', 'Pro', 'Admin');

insert into public.account_profiles (user_id, email, plan)
select
  users.id,
  users.email,
  case
    when lower(users.email) = 'samborth@icloud.com' then 'admin'
    else 'free'
  end
from auth.users
where not exists (
  select 1
  from public.account_profiles profiles
  where profiles.user_id = users.id
);

create or replace function public.handle_new_user_account_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.account_profiles (user_id, email, plan)
  values (
    new.id,
    new.email,
    case
      when lower(new.email) = 'samborth@icloud.com' then 'admin'
      else 'free'
    end
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    plan = case
      when lower(excluded.email) = 'samborth@icloud.com' then 'admin'
      else public.account_profiles.plan
    end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_account_profile on auth.users;
create trigger on_auth_user_created_account_profile
after insert on auth.users
for each row execute function public.handle_new_user_account_profile();

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

drop trigger if exists set_account_profiles_updated_at on public.account_profiles;
create trigger set_account_profiles_updated_at
before update on public.account_profiles
for each row execute function public.set_updated_at();

alter table public.saved_deals enable row level security;
alter table public.pipeline_items enable row level security;
alter table public.portfolio_properties enable row level security;
alter table public.investor_contacts enable row level security;
alter table public.account_profiles enable row level security;

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

drop policy if exists "Users can read their own account profile" on public.account_profiles;
create policy "Users can read their own account profile"
on public.account_profiles for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their own account profile" on public.account_profiles;
create policy "Users can create their own account profile"
on public.account_profiles for insert
with check (
    auth.uid() = user_id
    and (
    plan = 'free'
    or (auth.jwt() ->> 'email' = 'samborth@icloud.com')
  )
);

drop policy if exists "Admin developer can update own account profile" on public.account_profiles;
create policy "Admin developer can update own account profile"
on public.account_profiles for update
using (auth.uid() = user_id and auth.jwt() ->> 'email' = 'samborth@icloud.com')
with check (auth.uid() = user_id and auth.jwt() ->> 'email' = 'samborth@icloud.com');
