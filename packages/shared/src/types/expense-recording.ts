import type { ExpenseCategory } from "./expense";
import type { SyncableRecord, SyncableStore } from "./sync";

/**
 * The expense record as it lives in local storage — mirrors StoredTrip's
 * role for trips, minus anything recording-specific (an expense is
 * created fully-formed, not built up live like a GPS trip). Keyed by
 * `clientId`, generated on-device at creation: the idempotency key both
 * locally and on the server (`unique (user_id, client_id)`), so a retried
 * sync after a dropped connection upserts instead of duplicating.
 *
 * Attaching a receipt photo requires connectivity — see the Expense
 * Tracking README section for why offline receipt capture was left out of
 * scope. An expense created offline simply has `receiptStoragePath: null`
 * until edited later, once back online.
 */
export interface StoredExpense extends SyncableRecord {
  /** The server-assigned id, once known. Null until the first successful sync. */
  serverId: string | null;
  userId: string;
  vehicleId: string | null;
  category: ExpenseCategory;
  amountUsd: number;
  incurredOn: string;
  description: string | null;
  receiptStoragePath: string | null;
  createdAt: string;
}

/**
 * Abstraction over "however this platform persists expenses on-device." A
 * web build implements this over IndexedDB. Mirrors TripStore's contract:
 * a row written here is never deleted (outside an explicit driver-
 * initiated delete) until `markSyncStatus` has recorded "synced".
 */
export interface ExpenseStore extends SyncableStore<StoredExpense> {
  createExpense(expense: StoredExpense): Promise<void>;
  updateExpense(clientId: string, patch: Partial<StoredExpense>): Promise<void>;
  getExpense(clientId: string): Promise<StoredExpense | null>;
  deleteExpense(clientId: string): Promise<void>;
  /** Every local expense regardless of sync status, newest first — the local half of the Expenses list, merged with whatever's already synced to Supabase. */
  listExpenses(userId: string): Promise<StoredExpense[]>;
}
