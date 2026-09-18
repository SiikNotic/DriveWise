/**
 * Offline-first sync primitives shared by the web dashboard and the mobile
 * tracking layer. Every entity that can be created while offline (trips,
 * trip points, expenses, offers) is wrapped in a SyncEnvelope so the local
 * store and Supabase can reconcile without duplicating rows.
 */

export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

export type SyncOperation = "create" | "update" | "delete";

export type SyncEntityType =
  | "trip"
  | "trip_point"
  | "delivery_offer"
  | "expense"
  | "vehicle"
  | "user_settings";

/**
 * clientId is a UUID generated on-device at creation time. It is the
 * idempotency key: Supabase upserts on (user_id, client_id) so a retried
 * sync after a dropped connection never creates a duplicate row.
 */
export interface SyncEnvelope<TPayload> {
  clientId: string;
  entityType: SyncEntityType;
  operation: SyncOperation;
  payload: TPayload;
  createdAtLocal: string;
  syncStatus: SyncStatus;
  retryCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
}

export interface SyncQueueItem<TPayload = unknown> extends SyncEnvelope<TPayload> {
  id: string;
}
