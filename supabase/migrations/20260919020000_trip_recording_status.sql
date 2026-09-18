-- Mileage tracking: trips now go through a live recording lifecycle
-- (tracking -> paused -> completed) before they're ever eligible for sync,
-- which is a separate, orthogonal status. `is_pending_sync` conflated "not
-- yet recorded" with "not yet synced" and had no way to represent a sync
-- failure distinctly from "hasn't tried yet" — split into two columns that
-- match packages/shared/src/types/trip-recording.ts exactly.

alter table public.trips
  add column status text not null default 'completed' check (status in ('tracking', 'paused', 'completed')),
  add column sync_status text not null default 'synced' check (sync_status in ('pending_sync', 'synced', 'sync_error')),
  add column sync_error text,
  add column sync_retry_count integer not null default 0 check (sync_retry_count >= 0),
  add column next_sync_attempt_at timestamptz;

update public.trips
set sync_status = case when is_pending_sync then 'pending_sync' else 'synced' end;

alter table public.trips drop column is_pending_sync;

-- The sync queue's own lookup: completed trips still owed a sync attempt,
-- whose backoff window (if any) has elapsed. A partial index keyed to
-- exactly this predicate stays tiny regardless of how many trips a driver
-- accumulates, since the overwhelming majority are quickly "completed" +
-- "synced" and fall outside it entirely.
create index trips_syncable_idx on public.trips (user_id, next_sync_attempt_at)
where status = 'completed' and sync_status in ('pending_sync', 'sync_error');
