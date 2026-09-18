-- Advisor: unindexed_foreign_keys. These FK columns are joined/filtered on
-- (vehicle lookups, cascading updates) but had no covering index.
create index trips_vehicle_id_idx on public.trips (vehicle_id);
create index expenses_vehicle_id_idx on public.expenses (vehicle_id);
create index delivery_offers_vehicle_id_idx on public.delivery_offers (vehicle_id);
create index delivery_offers_linked_trip_id_idx on public.delivery_offers (linked_trip_id);
create index user_settings_default_vehicle_id_idx on public.user_settings (default_vehicle_id);
