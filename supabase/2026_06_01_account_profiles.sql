-- AcquiraIQ account profiles migration
-- Run this in Supabase SQL Editor if Dashboard or Account shows:
-- "Could not find the table public.account_profiles in the schema cache"

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

create table if not exists public.account_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free',
  stripe_customer_id text,
  subscription_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_profiles
drop constraint if exists account_profiles_plan_check;

update public.account_profiles
set plan = lower(plan)
where plan in ('Free', 'Premium', 'Pro', 'Admin');

alter table public.account_profiles
add constraint account_profiles_plan_check
check (plan in ('free', 'premium', 'pro', 'admin'));

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

drop trigger if exists set_account_profiles_updated_at on public.account_profiles;
create trigger set_account_profiles_updated_at
before update on public.account_profiles
for each row execute function public.set_updated_at();

alter table public.account_profiles enable row level security;

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
