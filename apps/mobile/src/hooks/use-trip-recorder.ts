import { useCallback, useEffect, useState } from "react";
import * as Crypto from "expo-crypto";
import { SyncQueue, TripRecorder, type StartTripInput, type TripRecorderSnapshot } from "@drivewise/shared";

import { ExpoLocationProvider } from "../lib/location/expo-location-provider";
import { SqliteTripStore } from "../lib/storage/sqlite-trip-store";
import { SupabaseSyncTransport } from "../lib/sync/supabase-sync-transport";
import { useOnlineStatusRef } from "./use-online-status";

const SYNC_POLL_INTERVAL_MS = 30_000;
const DURATION_TICK_INTERVAL_MS = 1_000;

const IDLE_SNAPSHOT: TripRecorderSnapshot = {
  status: "idle",
  tripClientId: null,
  distanceMiles: 0,
  durationSeconds: 0,
  pointCount: 0,
  gpsStatus: "idle",
  lastError: null,
};

/**
 * Wires the platform-agnostic TripRecorder/SyncQueue (packages/shared) to
 * this platform's implementations (SQLite, expo-location's background task,
 * Supabase) and to React — the mobile counterpart of apps/web's
 * use-trip-recorder.ts. Everything it calls into is unchanged from the web
 * hook's own engine; only the three platform implementations differ.
 */
export function useTripRecorder(userId: string) {
  const isOnlineRef = useOnlineStatusRef();

  const [engine] = useState(() => {
    const tripStore = new SqliteTripStore();
    const recorder = new TripRecorder({
      locationProvider: new ExpoLocationProvider(),
      tripStore,
      generateId: () => Crypto.randomUUID(),
    });
    const syncQueue = new SyncQueue({
      store: tripStore,
      transport: new SupabaseSyncTransport(tripStore),
      isOnline: () => isOnlineRef.current,
    });
    return { recorder, syncQueue };
  });
  const [snapshot, setSnapshot] = useState<TripRecorderSnapshot>(IDLE_SNAPSHOT);
  const [justRecovered, setJustRecovered] = useState(false);

  // Subscribe to the recorder, and recover any trip left "tracking"/"paused"
  // from a previous session (a crash, a force-quit, the OS reclaiming
  // memory) — the same recovery path the web hook uses.
  useEffect(() => {
    const unsubscribe = engine.recorder.subscribe(setSnapshot);
    void engine.recorder.recoverActiveTrip(userId).then((recovered) => {
      if (recovered) setJustRecovered(true);
    });
    return unsubscribe;
  }, [engine, userId]);

  // Drain the sync queue: immediately, and on an interval. (No "just came
  // back online" push here the way the web hook has one — NetInfo's
  // listener already re-fires and this interval picks it up within
  // SYNC_POLL_INTERVAL_MS regardless.)
  useEffect(() => {
    void engine.syncQueue.runOnce(userId);
    const interval = setInterval(() => void engine.syncQueue.runOnce(userId), SYNC_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [engine, userId]);

  // The recorder only emits a new snapshot when a GPS fix arrives, which
  // would make a visible timer stall between fixes — tick it locally too.
  useEffect(() => {
    if (snapshot.status !== "tracking") return;
    const interval = setInterval(() => {
      setSnapshot(engine.recorder.getSnapshot());
    }, DURATION_TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [engine, snapshot.status]);

  const start = useCallback(
    (input: Omit<StartTripInput, "userId">) => engine.recorder.start({ userId, ...input }),
    [engine, userId],
  );
  const pause = useCallback(() => engine.recorder.pause(), [engine]);
  const resume = useCallback(() => engine.recorder.resume(), [engine]);
  const stop = useCallback(
    (earnings?: { earningsUsd?: number | null; tipsUsd?: number | null }) =>
      engine.recorder.stop(earnings),
    [engine],
  );
  const discard = useCallback(() => engine.recorder.discard(), [engine]);

  return { snapshot, justRecovered, start, pause, resume, stop, discard };
}
