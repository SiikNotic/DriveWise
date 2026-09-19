import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { TripPurpose } from "@drivewise/shared";

import { supabase } from "../lib/supabase";
import { useTripRecorder } from "../hooks/use-trip-recorder";
import { colors } from "../theme";

const PURPOSES: TripPurpose[] = ["business", "personal", "commute"];

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function TrackingScreen({ userId }: { userId: string }) {
  const { snapshot, justRecovered, start, pause, resume, stop, discard } = useTripRecorder(userId);
  const [vehicles, setVehicles] = useState<{ id: string; nickname: string }[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<TripPurpose>("business");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([
      supabase.from("vehicles").select("id, nickname").eq("user_id", userId),
      supabase.from("user_settings").select("default_vehicle_id").eq("user_id", userId).maybeSingle(),
    ]).then(([{ data: vehicleRows }, { data: settings }]) => {
      if (!vehicleRows) return;
      setVehicles(vehicleRows);
      const active = vehicleRows.find((vehicle) => vehicle.id === settings?.default_vehicle_id);
      setVehicleId(active?.id ?? vehicleRows[0]?.id ?? null);
    });
  }, [userId]);

  const isIdle = snapshot.status === "idle";
  const isPaused = snapshot.status === "paused";

  async function handleStart() {
    setBusy(true);
    try {
      await start({ vehicleId, purpose });
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    try {
      await stop({});
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Tracking</Text>

        {justRecovered ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Picked up a trip that was interrupted — resume when you&apos;re ready.
            </Text>
          </View>
        ) : null}

        {snapshot.lastError === "permission_denied" ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              Location access was denied. Enable it in your device settings to track trips.
            </Text>
          </View>
        ) : null}

        {isIdle ? (
          <View style={styles.card}>
            <Text style={styles.label}>Vehicle</Text>
            <View style={styles.chipRow}>
              {vehicles.map((vehicle) => (
                <Pressable
                  key={vehicle.id}
                  onPress={() => setVehicleId(vehicle.id)}
                  style={[styles.chip, vehicleId === vehicle.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, vehicleId === vehicle.id && styles.chipTextActive]}>
                    {vehicle.nickname}
                  </Text>
                </Pressable>
              ))}
              {vehicles.length === 0 ? <Text style={styles.mutedText}>No vehicles yet</Text> : null}
            </View>

            <Text style={styles.label}>Purpose</Text>
            <View style={styles.chipRow}>
              {PURPOSES.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setPurpose(value)}
                  style={[styles.chip, purpose === value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, purpose === value && styles.chipTextActive]}>{value}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={[styles.primaryButton, busy && styles.disabled]} onPress={handleStart} disabled={busy}>
              <Text style={styles.primaryButtonText}>Start Tracking</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Distance</Text>
                <Text style={styles.statValue}>{snapshot.distanceMiles.toFixed(1)} mi</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Duration</Text>
                <Text style={styles.statValue}>{formatDuration(snapshot.durationSeconds)}</Text>
              </View>
            </View>
            <Text style={styles.gpsStatus}>GPS: {snapshot.gpsStatus}</Text>

            <View style={styles.buttonRow}>
              {isPaused ? (
                <Pressable style={[styles.primaryButton, styles.flexButton]} onPress={() => void resume()}>
                  <Text style={styles.primaryButtonText}>Resume</Text>
                </Pressable>
              ) : (
                <Pressable style={[styles.secondaryButton, styles.flexButton]} onPress={() => void pause()}>
                  <Text style={styles.secondaryButtonText}>Pause</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.primaryButton, styles.flexButton, busy && styles.disabled]}
                onPress={handleStop}
                disabled={busy}
              >
                <Text style={styles.primaryButtonText}>Stop</Text>
              </Pressable>
            </View>
            <Pressable style={styles.destructiveLink} onPress={() => void discard()} disabled={busy}>
              <Text style={styles.destructiveLinkText}>Discard trip</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: "700", color: colors.foreground },
  notice: { backgroundColor: "#fff8e6", borderRadius: 10, padding: 12 },
  noticeText: { color: colors.foreground, fontSize: 13 },
  errorBanner: { backgroundColor: "#fbe9e7", borderRadius: 10, padding: 12 },
  errorText: { color: colors.destructive, fontSize: 13 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 13, fontWeight: "600", color: colors.mutedForeground, textTransform: "uppercase" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 14, textTransform: "capitalize" },
  chipTextActive: { color: colors.primaryForeground },
  mutedText: { color: colors.mutedForeground, fontSize: 13 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: colors.primaryForeground, fontSize: 16, fontWeight: "600" },
  secondaryButton: { backgroundColor: colors.card, borderRadius: 10, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.foreground, fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.6 },
  statsRow: { flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center", gap: 4 },
  statLabel: { fontSize: 12, color: colors.mutedForeground },
  statValue: { fontSize: 28, fontWeight: "700", color: colors.foreground },
  gpsStatus: { textAlign: "center", fontSize: 12, color: colors.mutedForeground },
  buttonRow: { flexDirection: "row", gap: 8 },
  flexButton: { flex: 1 },
  destructiveLink: { alignItems: "center", paddingTop: 4 },
  destructiveLinkText: { color: colors.destructive, fontSize: 13 },
});
