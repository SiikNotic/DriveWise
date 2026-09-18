import type { ExpenseCategory, StoredExpense, SyncStatus } from "@drivewise/shared";

import { createClient } from "@/lib/supabase/client";
import { IndexedDbExpenseStore } from "@/lib/expenses/indexeddb-expense-store";
import { updateExpenseAction, deleteExpenseAction } from "@/lib/expenses/actions";
import { initialExpenseActionState, isAllowedReceiptType, MAX_RECEIPT_BYTES } from "@/lib/expenses/types";

const MAX_SERVER_EXPENSES = 1000;

/**
 * An expense as the Expenses UI wants to see it, regardless of whether it
 * has synced to Supabase yet — mirrors trip-source.ts's TripListRow.
 * `serverId` is null until sync succeeds; that's the only signal the UI
 * needs to know which backend an edit or delete has to go through.
 */
export interface ExpenseListRow {
  clientId: string;
  serverId: string | null;
  vehicleId: string | null;
  category: ExpenseCategory;
  amountUsd: number;
  incurredOn: string;
  description: string | null;
  receiptStoragePath: string | null;
  syncStatus: SyncStatus;
}

function storedExpenseToRow(expense: StoredExpense): ExpenseListRow {
  return {
    clientId: expense.clientId,
    serverId: expense.serverId,
    vehicleId: expense.vehicleId,
    category: expense.category,
    amountUsd: expense.amountUsd,
    incurredOn: expense.incurredOn,
    description: expense.description,
    receiptStoragePath: expense.receiptStoragePath,
    syncStatus: expense.syncStatus,
  };
}

/**
 * The complete Expenses list is the union of two sources that never
 * overlap in practice: expenses still only in IndexedDB (not yet synced)
 * and expenses already synced to Supabase — same pattern as trips.
 */
export async function fetchExpenseRows(userId: string): Promise<ExpenseListRow[]> {
  const store = new IndexedDbExpenseStore();
  const supabase = createClient();

  const [localExpenses, { data: serverExpenses }] = await Promise.all([
    store.listExpenses(userId),
    supabase
      .from("expenses")
      .select(
        "id, client_id, vehicle_id, category, amount_usd, incurred_on, description, receipt_storage_path, sync_status",
      )
      .order("incurred_on", { ascending: false })
      .limit(MAX_SERVER_EXPENSES),
  ]);

  const pendingLocal = localExpenses.filter((expense) => expense.syncStatus !== "synced").map(storedExpenseToRow);

  const synced: ExpenseListRow[] = (serverExpenses ?? []).map((row) => ({
    clientId: row.client_id,
    serverId: row.id,
    vehicleId: row.vehicle_id,
    category: row.category,
    amountUsd: row.amount_usd,
    incurredOn: row.incurred_on,
    description: row.description,
    receiptStoragePath: row.receipt_storage_path,
    syncStatus: row.sync_status,
  }));

  return [...pendingLocal, ...synced].sort((a, b) => b.incurredOn.localeCompare(a.incurredOn));
}

export interface ExpenseDetail {
  row: ExpenseListRow;
}

/** Looks an expense up by its client-generated id, the one identifier stable across both backends. */
export async function fetchExpenseDetail(clientId: string, userId: string): Promise<ExpenseDetail | null> {
  const supabase = createClient();
  const { data: serverExpense } = await supabase
    .from("expenses")
    .select(
      "id, client_id, vehicle_id, category, amount_usd, incurred_on, description, receipt_storage_path, sync_status",
    )
    .eq("client_id", clientId)
    .maybeSingle();

  if (serverExpense) {
    return {
      row: {
        clientId: serverExpense.client_id,
        serverId: serverExpense.id,
        vehicleId: serverExpense.vehicle_id,
        category: serverExpense.category,
        amountUsd: serverExpense.amount_usd,
        incurredOn: serverExpense.incurred_on,
        description: serverExpense.description,
        receiptStoragePath: serverExpense.receipt_storage_path,
        syncStatus: serverExpense.sync_status,
      },
    };
  }

  const store = new IndexedDbExpenseStore();
  const localExpense = await store.getExpense(clientId);
  if (!localExpense || localExpense.userId !== userId) return null;
  return { row: storedExpenseToRow(localExpense) };
}

export interface CreateExpenseInput {
  userId: string;
  vehicleId: string | null;
  category: ExpenseCategory;
  amountUsd: number;
  incurredOn: string;
  description: string | null;
}

/**
 * Always local-first: an expense is written to IndexedDB immediately,
 * online or not, then flipped straight to "pending" — an expense is
 * complete the moment it's created (unlike a trip, there's no live
 * recording phase to wait out). The background sync queue (see
 * useExpenseSync) pushes it to Supabase whenever connectivity allows.
 */
export async function createExpenseLocal(input: CreateExpenseInput): Promise<string> {
  const store = new IndexedDbExpenseStore();
  const clientId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const expense: StoredExpense = {
    clientId,
    serverId: null,
    userId: input.userId,
    vehicleId: input.vehicleId,
    category: input.category,
    amountUsd: input.amountUsd,
    incurredOn: input.incurredOn,
    description: input.description,
    receiptStoragePath: null,
    syncStatus: "local",
    syncError: null,
    syncRetryCount: 0,
    nextSyncAttemptAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await store.createExpense(expense);
  await store.markSyncStatus(clientId, { syncStatus: "pending" });
  return clientId;
}

/**
 * Best-effort only: attaching a receipt requires connectivity (see the
 * Expense Tracking README section on why offline receipt capture is out
 * of scope). Silently does nothing while offline — the expense record
 * itself is already saved either way; the driver can attach a receipt
 * later by editing the expense once back online.
 */
export async function attachReceiptIfOnline(clientId: string, userId: string, file: File): Promise<void> {
  if (!navigator.onLine || file.size === 0) return;
  if (file.size > MAX_RECEIPT_BYTES || !isAllowedReceiptType(file.type)) return;
  const supabase = createClient();
  const extension = (/\.([a-zA-Z0-9]{1,8})$/.exec(file.name)?.[1] ?? "jpg").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (error) return;
  const store = new IndexedDbExpenseStore();
  await store.updateExpense(clientId, { receiptStoragePath: path });
}

export interface ExpensePatch {
  vehicleId: string | null;
  category: ExpenseCategory;
  amountUsd: number;
  incurredOn: string;
  description: string | null;
}

/** Edits go straight to IndexedDB for a still-local expense and through a Server Action once synced — same dual dispatch as trip-source.ts. */
export async function updateExpenseRecord(row: ExpenseListRow, patch: ExpensePatch): Promise<{ error?: string }> {
  if (row.syncStatus === "synced" && row.serverId) {
    const formData = new FormData();
    formData.set("id", row.serverId);
    formData.set("vehicleId", patch.vehicleId ?? "");
    formData.set("category", patch.category);
    formData.set("amountUsd", String(patch.amountUsd));
    formData.set("incurredOn", patch.incurredOn);
    formData.set("description", patch.description ?? "");
    formData.set("removeReceipt", "false");
    const result = await updateExpenseAction(initialExpenseActionState, formData);
    return { error: result.error };
  }

  const store = new IndexedDbExpenseStore();
  await store.updateExpense(row.clientId, {
    vehicleId: patch.vehicleId,
    category: patch.category,
    amountUsd: patch.amountUsd,
    incurredOn: patch.incurredOn,
    description: patch.description,
  });
  return {};
}

/** Same dual dispatch as updateExpenseRecord — deleting a still-local expense just removes it from IndexedDB directly. */
export async function deleteExpenseRecord(row: ExpenseListRow): Promise<{ error?: string }> {
  if (row.syncStatus === "synced" && row.serverId) {
    const formData = new FormData();
    formData.set("id", row.serverId);
    const result = await deleteExpenseAction(initialExpenseActionState, formData);
    return { error: result.error };
  }

  const store = new IndexedDbExpenseStore();
  await store.deleteExpense(row.clientId);
  return {};
}
