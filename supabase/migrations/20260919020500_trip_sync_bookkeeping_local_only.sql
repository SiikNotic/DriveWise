-- Retry bookkeeping (how many attempts, when to retry next, the last error
-- message) is meaningful only to the device still trying to sync a trip —
-- packages/shared/src/types/trip-recording.ts's StoredTrip already carries
-- all three locally. A row that exists in this table at all is, by
-- definition, synced (the client only pushes a trip once it's ready), so
-- keeping these columns here too was redundant and would only ever read
-- back their default values. `sync_status` itself stays: a future feature
-- reading trips straight from Supabase (e.g. a cross-device trip list)
-- still has a legitimate use for it.
alter table public.trips
  drop column sync_error,
  drop column sync_retry_count,
  drop column next_sync_attempt_at;

drop index if exists public.trips_syncable_idx;
