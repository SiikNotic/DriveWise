import { useEffect, useState } from "react";
import type { TripPurpose } from "@drivewise/shared";

import { supabase } from "../lib/supabase";
import { useTripRecorder } from "../hooks/use-trip-recorder";

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
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    try {
      await stop({});
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-foreground">Tracking</h1>

        {justRecovered ? (
          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-sm text-foreground">Picked up a trip that was interrupted — resume when you&apos;re ready.</p>
          </div>
        ) : null}

        {snapshot.lastError === "permission_denied" ? (
          <div className="rounded-xl bg-red-50 p-3">
            <p className="text-sm text-destructive">Location access was denied. Enable it in your device settings to track trips.</p>
          </div>
        ) : null}

        {isIdle ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Vehicle</p>
            <div className="flex flex-wrap gap-2">
              {vehicles.map((vehicle) => (
                <button
                  key={vehicle.id}
                  onClick={() => setVehicleId(vehicle.id)}
                  className={`rounded-full border px-3.5 py-2 text-sm ${
                    vehicleId === vehicle.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground"
                  }`}
                >
                  {vehicle.nickname}
                </button>
              ))}
              {vehicles.length === 0 ? <p className="text-sm text-muted-foreground">No vehicles yet</p> : null}
            </div>

            <p className="text-xs font-semibold uppercase text-muted-foreground">Purpose</p>
            <div className="flex flex-wrap gap-2">
              {PURPOSES.map((value) => (
                <button
                  key={value}
                  onClick={() => setPurpose(value)}
                  className={`rounded-full border px-3.5 py-2 text-sm capitalize ${
                    purpose === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>

            <button
              className="w-full rounded-lg bg-primary py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-60"
              onClick={() => void handleStart()}
              disabled={busy}
            >
              Start Tracking
            </button>
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex justify-around">
              <div className="space-y-1 text-center">
                <p className="text-xs text-muted-foreground">Distance</p>
                <p className="text-3xl font-bold text-foreground">{snapshot.distanceMiles.toFixed(1)} mi</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-3xl font-bold text-foreground">{formatDuration(snapshot.durationSeconds)}</p>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground">GPS: {snapshot.gpsStatus}</p>

            <div className="flex gap-2">
              {isPaused ? (
                <button
                  className="flex-1 rounded-lg bg-primary py-3.5 text-base font-semibold text-primary-foreground"
                  onClick={() => void resume()}
                >
                  Resume
                </button>
              ) : (
                <button
                  className="flex-1 rounded-lg border border-border bg-card py-3.5 text-base font-semibold text-foreground"
                  onClick={() => void pause()}
                >
                  Pause
                </button>
              )}
              <button
                className="flex-1 rounded-lg bg-primary py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-60"
                onClick={() => void handleStop()}
                disabled={busy}
              >
                Stop
              </button>
            </div>
            <button className="w-full pt-1 text-center text-sm text-destructive" onClick={() => void discard()} disabled={busy}>
              Discard trip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
