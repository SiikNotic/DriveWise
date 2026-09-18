import type { StoredExpense, SyncPushResult, SyncTransport } from "@drivewise/shared";

import { createClient } from "@/lib/supabase/client";

/**
 * Web implementation of SyncTransport<StoredExpense>, over the Supabase
 * browser client — mirrors SupabaseSyncTransport (trips). A receipt photo
 * is uploaded before this expense was ever created offline (attaching a
 * receipt requires connectivity — see the Expense Tracking README
 * section), so there's no separate upload step here: the row already
 * carries whatever `receiptStoragePath` it has.
 */
export class SupabaseExpenseTransport implements SyncTransport<StoredExpense> {
  async push(expense: StoredExpense): Promise<SyncPushResult> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("expenses")
      .upsert(
        {
          user_id: expense.userId,
          client_id: expense.clientId,
          vehicle_id: expense.vehicleId,
          category: expense.category,
          amount_usd: expense.amountUsd,
          incurred_on: expense.incurredOn,
          description: expense.description,
          receipt_storage_path: expense.receiptStoragePath,
          sync_status: "synced",
        },
        { onConflict: "user_id,client_id" },
      )
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Unknown error syncing expense" };
    }
    return { ok: true, serverId: data.id };
  }
}
