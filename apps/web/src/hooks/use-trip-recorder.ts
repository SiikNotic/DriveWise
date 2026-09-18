"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SyncQueue,
  TripRecorder,
  type StartTripInput,
  type TripRecorderSnapshot,
} from "@drivewise/shared";

import { BrowserLocationProvider } from "@/lib/tracking/browser-location-provider";
import { IndexedDbTripStore } from "@/lib/tracking/indexeddb-trip-store";
import { SupabaseSyncTransport } from "@/lib/tracking/supabase-sync-transport";
import { useOnlineStatus } from "@/hooks/use-online-status";

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
 * this platform's implementations (IndexedDB, browser Geolocation,
 * Supabase) and to React. A native mobile client would write the
 * equivalent of this file once for its own framework — everything it
 * calls into is unchanged.
 */
export function useTripRecorder(userId: string) {
  // Lazy useState initializer, not a ref: this engine (TripRecorder +
  // SyncQueue, wired to their web implementations) must be created exactly
  // once per mount and never reassigned — a ref mutated during render is
  // the pattern React's own rules now flag, since it's invisible to
  // concurrent rendering. Neither value is ever *set* again after this.
  const [engine] = useState(() => {
    const tripStore = new IndexedDbTripStore();
    const recorder = new TripRecorder({
      locationProvider: new BrowserLocationProvider(),
      tripStore,
      generateId: () => crypto.randomUUID(),
    });
    const syncQueue = new SyncQueue({
      tripStore,
      transport: new SupabaseSyncTransport(),
      isOnline: () => navigator.onLine,
    });
    return { recorder, syncQueue };
  });
  const [snapshot, setSnapshot] = useState<TripRecorderSnapshot>(IDLE_SNAPSHOT);
  const [justRecovered, setJustRecovered] = useState(false);
  const isOnline = useOnlineStatus();

  // Subscribe to the recorder, and recover any trip left "tracking"/"paused"
  // from a previous session (a crash, a closed tab, a suspended app).
  useEffect(() => {
    const unsubscribe = engine.recorder.subscribe(setSnapshot);
    void engine.recorder.recoverActiveTrip(userId).then((recovered) => {
      if (recovered) setJustRecovered(true);
    });
    return unsubscribe;
  }, [engine, userId]);

  // Drain the sync queue: immediately, on an interval, and whenever the
  // browser reports coming back online.
  useEffect(() => {
    void engine.syncQueue.runOnce(userId);
    const interval = setInterval(() => void engine.syncQueue.runOnce(userId), SYNC_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [engine, userId]);

  useEffect(() => {
    if (!isOnline) return;
    void engine.syncQueue.runOnce(userId);
  }, [engine, isOnline, userId]);

  // The recorder only emits a new snapshot when a GPS fix arrives, which
  // would make the visible timer stall between fixes — tick it locally too.
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
