import { useCallback, useEffect, useState } from "react";
import { SyncQueue } from "@drivewise/shared";

import { IndexedDbTripStore } from "../lib/storage/indexeddb-trip-store";
import { SupabaseSyncTransport } from "../lib/sync/supabase-sync-transport";
import { fetchTripRows, type TripListRow } from "../lib/trip-source";

const SYNC_LABEL: Record<TripListRow["syncStatus"], string> = {
  local: "Saved on this device",
  pending: "Pending sync",
  syncing: "Syncing…",
  synced: "Synced",
  failed: "Sync failed — will retry",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TripsScreen({ userId }: { userId: string }) {
  const [rows, setRows] = useState<TripListRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const result = await fetchTripRows(userId);
    setRows(result);
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    const tripStore = new IndexedDbTripStore();
    const syncQueue = new SyncQueue({
      store: tripStore,
      transport: new SupabaseSyncTransport(tripStore),
      isOnline: () => true,
    });
    void syncQueue.runOnce(userId).then(refresh);
  }, [userId, refresh]);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-2xl font-bold text-foreground">Trips</h1>
        <button className="text-sm text-primary disabled:opacity-60" onClick={() => void handleRefresh()} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="space-y-2 p-4">
        {loaded && rows.length === 0 ? (
          <p className="mt-8 text-center text-muted-foreground">No trips yet — start tracking to record one.</p>
        ) : null}
        {rows.map((row) => (
          <div
            key={row.clientId}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5"
          >
            <div className="space-y-0.5">
              <p className="text-base font-semibold text-foreground">{formatDate(row.startedAt)}</p>
              <p className="text-xs capitalize text-muted-foreground">{row.purpose}</p>
            </div>
            <div className="space-y-0.5 text-right">
              <p className="text-base font-semibold text-foreground">{row.distanceMiles.toFixed(1)} mi</p>
              <p className="text-xs text-muted-foreground">{SYNC_LABEL[row.syncStatus]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
