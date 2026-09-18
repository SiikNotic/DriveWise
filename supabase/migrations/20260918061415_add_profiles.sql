-- Driver profile: the identity fields collected at sign-up (first/last
-- name, phone, country, state). Email lives in auth.users (the session
-- already carries it — no need to duplicate and keep it in sync here).
-- Preferred language is user_settings.language, which already existed —
-- this migration doesn't duplicate it.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  -- ISO 3166-1 alpha-2 country code (e.g. 'US'). Free text, not a check
  -- constraint enum: the curated option list lives in the frontend
  -- (packages/shared), so adding a country later never needs a migration.
  country text,
  -- US state/territory code (e.g. 'CA', 'PR'), only meaningful when
  -- country = 'US'. Same free-text rationale as above.
  state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "profiles_update_own" on public.profiles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create trigger set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Extend the existing signup trigger to also seed a profile row from the
-- metadata passed to supabase.auth.signUp({ options: { data: {...} } }).
-- raw_user_meta_data is user-supplied at signup time — fine as an initial
-- value for a name/phone/location field, never used here for an
-- authorization decision (see the security skill's warning on that).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.profiles (user_id, first_name, last_name, phone, country, state)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'country',
    new.raw_user_meta_data ->> 'state'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;
