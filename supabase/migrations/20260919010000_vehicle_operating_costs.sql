-- Vehicle Profile: replaces the placeholder cost fields from the initial
-- schema with the actual driver-editable inputs the operating-cost
-- breakdown needs (fuel, maintenance, depreciation, insurance, other), each
-- expressed the way a driver actually thinks about it (per mile, except
-- insurance which is billed monthly and gets allocated per mile using
-- estimated_monthly_miles). Nothing here is a tax figure — see
-- packages/shared/src/calculations/vehicle-cost.ts for the disclaimer this
-- backs.
--
-- `is_active` is dropped: "active vehicle" is a single per-user choice
-- (there's already `user_settings.default_vehicle_id` for that), not a
-- per-row flag, and having both invited confusion about which one the UI
-- meant. `cost_per_mile_override_usd` is dropped too: every cost component
-- is now directly user-editable, so a separate flat override no longer
-- serves a purpose distinct from just editing the components themselves.
-- Neither column has any application code depending on it yet.

alter table public.vehicles
  add column trim text,
  add column fuel_price_usd numeric not null default 0 check (fuel_price_usd >= 0),
  add column maintenance_cost_per_mile_usd numeric not null default 0 check (maintenance_cost_per_mile_usd >= 0),
  add column depreciation_cost_per_mile_usd numeric not null default 0 check (depreciation_cost_per_mile_usd >= 0),
  add column other_operating_cost_per_mile_usd numeric not null default 0 check (other_operating_cost_per_mile_usd >= 0),
  add column estimated_monthly_miles numeric not null default 1000 check (estimated_monthly_miles > 0);

alter table public.vehicles
  rename column monthly_fixed_cost_usd to insurance_monthly_cost_usd;

alter table public.vehicles
  alter column insurance_monthly_cost_usd set default 0,
  alter column insurance_monthly_cost_usd set not null;

update public.vehicles set insurance_monthly_cost_usd = 0 where insurance_monthly_cost_usd is null;

alter table public.vehicles
  drop column cost_per_mile_override_usd,
  drop column is_active;

-- MPG is now a required input (the fuel cost calculation divides by it).
update public.vehicles set fuel_efficiency_mpg = 1 where fuel_efficiency_mpg is null or fuel_efficiency_mpg <= 0;
alter table public.vehicles alter column fuel_efficiency_mpg set not null;
