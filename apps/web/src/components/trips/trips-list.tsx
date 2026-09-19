"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRightIcon } from "lucide-react";
import { SyncQueue, formatDuration, formatMiles } from "@drivewise/shared";

import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { IndexedDbTripStore } from "@/lib/tracking/indexeddb-trip-store";
import { SupabaseSyncTransport } from "@/lib/tracking/supabase-sync-transport";
import { fetchTripRows, type TripListRow } from "@/lib/trips/trip-source";

const REFRESH_INTERVAL_MS = 30_000;

type TabKey = "today" | "thisWeek" | "thisMonth" | "all";

const SYNC_TONE: Record<TripListRow["syncStatus"], StatusTone> = {
  local: "neutral",
  pending: "warning",
  syncing: "warning",
  synced: "positive",
  failed: "serious",
};

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Same "the driver's local day, not the server's" principle as the Dashboard — see dashboard-metrics.tsx. */
function bucketsFor(now: Date) {
  const todayKey = toLocalDateKey(now);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { todayKey, weekStart, monthStart };
}

export function TripsList({
  userId,
  vehicles,
  distanceUnitLabel,
}: {
  userId: string;
  vehicles: { id: string; nickname: string }[];
  distanceUnitLabel: string;
}) {
  const t = useTranslations("trips");
  const locale = useLocale();
  const isOnline = useOnlineStatus();

  const [rows, setRows] = useState<TripListRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<TabKey>("today");

  const vehicleName = useMemo(() => {
    const map = new Map(vehicles.map((v) => [v.id, v.nickname]));
    return (id: string | null) => (id ? (map.get(id) ?? t("noVehicle")) : t("noVehicle"));
  }, [vehicles, t]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const result = await fetchTripRows(userId);
    setRows(result);
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    // Draining the queue here too (not just on the Dashboard) means a trip
    // recorded while offline shows up as "Synced" on this page the moment
    // connectivity returns, without the driver needing to revisit Dashboard
    // first — same SyncQueue/transport, just run from a second place.
    const tripStore = new IndexedDbTripStore();
    const syncQueue = new SyncQueue({
      store: tripStore,
      transport: new SupabaseSyncTransport(tripStore),
      isOnline: () => navigator.onLine,
    });

    async function drainAndRefresh() {
      await syncQueue.runOnce(userId);
      await refresh();
    }

    void drainAndRefresh();
    const interval = setInterval(() => void drainAndRefresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId, refresh]);

  useEffect(() => {
    // Fetching from IndexedDB/Supabase (external systems) and syncing the
    // result into state is exactly what this effect is for — see the same
    // pattern (and rationale) in dashboard-metrics.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOnline) void refresh();
  }, [isOnline, refresh]);

  const { todayKey, weekStart, monthStart } = bucketsFor(new Date());

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((row) => {
      const started = new Date(row.startedAt);
      if (tab === "today") return toLocalDateKey(started) === todayKey;
      if (tab === "thisWeek") return started >= weekStart;
      return started >= monthStart;
    });
  }, [rows, tab, todayKey, weekStart, monthStart]);

  const dateFormat = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-4">
      {!isOnline ? (
        <Alert variant="warning">
          <AlertDescription>{t("offlineNotice")}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="today">{t("tabs.today")}</TabsTrigger>
          <TabsTrigger value="thisWeek">{t("tabs.thisWeek")}</TabsTrigger>
          <TabsTrigger value="thisMonth">{t("tabs.thisMonth")}</TabsTrigger>
          <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 flex flex-col gap-2">
          {!loaded ? (
            <p className="text-muted-foreground text-center text-sm">{t("empty.title")}</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center text-sm">
              {tab === "all" ? t("empty.description") : t("emptyPeriod")}
            </p>
          ) : (
            filtered.map((row) => {
              const started = new Date(row.startedAt);
              const ended = row.endedAt ? new Date(row.endedAt) : null;
              return (
                <Link key={row.clientId} href={`/trips/${row.clientId}`} className="block">
                  <Card className="pressable gap-3 py-3 transition-colors hover:bg-accent/50">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{dateFormat.format(started)}</span>
                          <span className="text-muted-foreground text-xs">
                            {timeFormat.format(started)}
                            {ended ? ` – ${timeFormat.format(ended)}` : ""}
                          </span>
                        </div>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                          <span>{vehicleName(row.vehicleId)}</span>
                          <span>{t(`purpose.${row.purpose}`)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-metric text-sm">
                            {formatMiles(row.distanceMiles, locale, distanceUnitLabel)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {formatDuration(row.durationSeconds)}
                          </span>
                        </div>
                        <StatusBadge tone={SYNC_TONE[row.syncStatus]}>
                          {t(`syncStatus.${row.syncStatus}`)}
                        </StatusBadge>
                        <ChevronRightIcon
                          className="text-muted-foreground/60 size-4 shrink-0"
                          aria-hidden="true"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
