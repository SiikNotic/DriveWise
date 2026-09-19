import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SyncQueue } from "@drivewise/shared";

import { supabase } from "../lib/supabase";
import { SqliteTripStore } from "../lib/storage/sqlite-trip-store";
import { SupabaseSyncTransport } from "../lib/sync/supabase-sync-transport";
import { fetchTripRows, type TripListRow } from "../lib/trip-source";
import { colors } from "../theme";

const SYNC_LABEL: Record<TripListRow["syncStatus"], string> = {
  local: "Saved on this device",
  pending: "Pending sync",
  syncing: "Syncing…",
  synced: "Synced",
  failed: "Sync failed — will retry",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
    const tripStore = new SqliteTripStore();
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Trips</Text>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.clientId}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          loaded ? <Text style={styles.empty}>No trips yet — start tracking to record one.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowDate}>{formatDate(item.startedAt)}</Text>
              <Text style={styles.rowPurpose}>{item.purpose}</Text>
            </View>
            <View style={styles.rowEnd}>
              <Text style={styles.rowDistance}>{item.distanceMiles.toFixed(1)} mi</Text>
              <Text style={styles.rowSync}>{SYNC_LABEL[item.syncStatus]}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: "700", color: colors.foreground, paddingHorizontal: 16, paddingTop: 8 },
  listContent: { padding: 16, gap: 8 },
  empty: { color: colors.mutedForeground, textAlign: "center", marginTop: 32 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  rowMain: { gap: 2 },
  rowDate: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  rowPurpose: { fontSize: 12, color: colors.mutedForeground, textTransform: "capitalize" },
  rowEnd: { alignItems: "flex-end", gap: 2 },
  rowDistance: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  rowSync: { fontSize: 11, color: colors.mutedForeground },
});
