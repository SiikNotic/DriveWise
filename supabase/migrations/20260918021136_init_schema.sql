-- DriveWise initial schema
-- Tables mirror the domain types in packages/shared/src/types.
-- Every row that a device can create offline carries a `client_id` (UUID
-- generated on-device) so a retried sync after a dropped connection upserts
-- instead of duplicating: unique (user_id, client_id) is the idempotency key.

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current on every UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null,
  nickname text not null,
  make text not null,
  model text not null,
  year integer not null check (year between 1980 and 2100),
  fuel_type text not null check (fuel_type in ('gasoline', 'diesel', 'hybrid', 'electric')),
  fuel_efficiency_mpg numeric check (fuel_efficiency_mpg > 0),
  monthly_fixed_cost_usd numeric check (monthly_fixed_cost_usd >= 0),
  cost_per_mile_override_usd numeric check (cost_per_mile_override_usd >= 0),
  odometer_miles numeric check (odometer_miles >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index vehicles_user_id_idx on public.vehicles (user_id);

alter table public.vehicles enable row level security;

create policy "vehicles_select_own" on public.vehicles
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "vehicles_insert_own" on public.vehicles
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "vehicles_update_own" on public.vehicles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "vehicles_delete_own" on public.vehicles
for delete to authenticated
using ((select auth.uid()) = user_id);

create trigger set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_settings (one row per user; language, units, defaults)
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  language text not null default 'en' check (language in ('en', 'es')),
  distance_unit text not null default 'mi' check (distance_unit in ('mi', 'km')),
  default_vehicle_id uuid references public.vehicles (id) on delete set null,
  standard_mileage_rate_usd numeric not null default 0.70 check (standard_mileage_rate_usd >= 0),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings_select_own" on public.user_settings
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "user_settings_insert_own" on public.user_settings
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "user_settings_update_own" on public.user_settings
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create trigger set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

-- Auto-create a default settings row when a new auth user signs up.
-- security definer is required here (a normal authenticated role cannot
-- write to public.user_settings on behalf of a not-yet-existing user), but
-- the function only ever inserts a row keyed to NEW.id from the trigger
-- payload, never caller-supplied input, so it cannot be used to write rows
-- for arbitrary users.
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
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  platform text check (platform in ('doordash', 'uber_eats', 'grubhub', 'instacart', 'other')),
  purpose text not null default 'business' check (purpose in ('business', 'personal', 'commute')),
  source text not null default 'gps_auto' check (source in ('gps_auto', 'manual')),
  started_at timestamptz not null,
  ended_at timestamptz,
  start_latitude double precision,
  start_longitude double precision,
  end_latitude double precision,
  end_longitude double precision,
  -- Simplified [{latitude, longitude}, ...] polyline for map rendering.
  -- Raw high-frequency GPS points stay in trip_points (or stay device-local
  -- entirely) to keep this row small and protect driver privacy.
  route_simplified jsonb,
  distance_miles numeric not null default 0 check (distance_miles >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  earnings_usd numeric check (earnings_usd >= 0),
  tips_usd numeric check (tips_usd >= 0),
  notes text,
  is_pending_sync boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index trips_user_id_started_at_idx on public.trips (user_id, started_at desc);

alter table public.trips enable row level security;

create policy "trips_select_own" on public.trips
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "trips_insert_own" on public.trips
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "trips_update_own" on public.trips
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "trips_delete_own" on public.trips
for delete to authenticated
using ((select auth.uid()) = user_id);

create trigger set_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- trip_points (optional raw GPS samples, only synced if the driver opts in)
-- ---------------------------------------------------------------------------
create table public.trip_points (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- Denormalized from trips.user_id so RLS can check ownership without a join.
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null,
  latitude double precision not null,
  longitude double precision not null,
  altitude_meters double precision,
  speed_mps double precision,
  horizontal_accuracy_meters double precision,
  recorded_at timestamptz not null,
  sequence integer not null,
  unique (user_id, client_id)
);

create index trip_points_trip_id_sequence_idx on public.trip_points (trip_id, sequence);

alter table public.trip_points enable row level security;

create policy "trip_points_select_own" on public.trip_points
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "trip_points_insert_own" on public.trip_points
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "trip_points_delete_own" on public.trip_points
for delete to authenticated
using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- delivery_offers
-- ---------------------------------------------------------------------------
create table public.delivery_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  platform text not null check (platform in ('doordash', 'uber_eats', 'grubhub', 'instacart', 'other')),
  offered_pay_usd numeric not null check (offered_pay_usd >= 0),
  estimated_distance_miles numeric not null check (estimated_distance_miles >= 0),
  estimated_duration_minutes numeric not null check (estimated_duration_minutes >= 0),
  estimated_return_distance_miles numeric check (estimated_return_distance_miles >= 0),
  decision text not null default 'declined' check (decision in ('accepted', 'declined', 'expired')),
  linked_trip_id uuid references public.trips (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index delivery_offers_user_id_created_at_idx on public.delivery_offers (user_id, created_at desc);

alter table public.delivery_offers enable row level security;

create policy "delivery_offers_select_own" on public.delivery_offers
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "delivery_offers_insert_own" on public.delivery_offers
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "delivery_offers_update_own" on public.delivery_offers
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "delivery_offers_delete_own" on public.delivery_offers
for delete to authenticated
using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  category text not null check (
    category in ('fuel', 'maintenance', 'insurance', 'vehicle_payment', 'phone_plan', 'supplies', 'parking_tolls', 'other')
  ),
  amount_usd numeric not null check (amount_usd >= 0),
  incurred_on date not null,
  description text,
  -- Path within the private "receipts" Supabase Storage bucket, not a public URL.
  receipt_storage_path text,
  is_tax_deductible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index expenses_user_id_incurred_on_idx on public.expenses (user_id, incurred_on desc);

alter table public.expenses enable row level security;

create policy "expenses_select_own" on public.expenses
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "expenses_insert_own" on public.expenses
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "expenses_update_own" on public.expenses
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "expenses_delete_own" on public.expenses
for delete to authenticated
using ((select auth.uid()) = user_id);

create trigger set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();
