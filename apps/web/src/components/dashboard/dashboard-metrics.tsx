"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  BanknoteIcon,
  CarIcon,
  DollarSignIcon,
  GaugeIcon,
  ReceiptIcon,
  RouteIcon,
} from "lucide-react";
import { formatMiles, formatUsd, formatUsdPerHour, formatUsdPerMile, type TripPurpose } from "@drivewise/shared";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MetricCard } from "@/components/finance/metric-card";
import { DonutGauge } from "@/components/ui/donut-gauge";

const PURPOSE_MILES_EMPTY: Record<TripPurpose, number> = { business: 0, personal: 0, commute: 0 };

const PURPOSE_COLOR: Record<TripPurpose, string> = {
  business: "var(--primary)",
  commute: "var(--chart-1)",
  personal: "var(--chart-4)",
};

interface Totals {
  miles: number;
  grossUsd: number;
  expensesUsd: number;
  durationSeconds: number;
  tripCount: number;
}

const EMPTY_TOTALS: Totals = { miles: 0, grossUsd: 0, expensesUsd: 0, durationSeconds: 0, tripCount: 0 };

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Adds a completed row's numbers into a running total, computed purely from the browser's own local clock — never the server's timezone. */
function accumulate(totals: Totals, distanceMiles: number, gross: number, durationSeconds: number): Totals {
  return {
    miles: totals.miles + distanceMiles,
    grossUsd: totals.grossUsd + gross,
    expensesUsd: totals.expensesUsd,
    durationSeconds: totals.durationSeconds + durationSeconds,
    tripCount: totals.tripCount + 1,
  };
}

export function DashboardMetrics({
  userId,
  distanceUnitLabel,
  hourUnitLabel,
  activeVehicleCostPerMileUsd,
  refreshSignal,
}: {
  userId: string;
  distanceUnitLabel: string;
  hourUnitLabel: string;
  activeVehicleCostPerMileUsd: number | null;
  refreshSignal: number;
}) {
  const t = useTranslations("dashboard");
  const tm = useTranslations("metrics");
  const te = useTranslations("expenses");
  const tp = useTranslations("trips.purpose");
  const locale = useLocale();

  const [today, setToday] = useState<Totals>(EMPTY_TOTALS);
  const [week, setWeek] = useState<Totals>(EMPTY_TOTALS);
  const [weekMilesByPurpose, setWeekMilesByPurpose] = useState<Record<TripPurpose, number>>(PURPOSE_MILES_EMPTY);
  const [loaded, setLoaded] = useState(false);

  const fetchTotals = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const now = new Date();
    const todayKey = toLocalDateKey(now);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);

    const [{ data: trips }, { data: expenses }, { data: allPurposeTrips }] = await Promise.all([
      supabase
        .from("trips")
        .select("distance_miles, duration_seconds, earnings_usd, tips_usd, ended_at")
        .eq("status", "completed")
        .eq("purpose", "business")
        .gte("ended_at", weekStart.toISOString()),
      supabase
        .from("expenses")
        .select("amount_usd, incurred_on")
        .gte("incurred_on", toLocalDateKey(weekStart)),
      // Separate from the query above on purpose: the "Mileage overview"
      // donut is about how miles split across every purpose, not just the
      // business-only earnings math the rest of this component computes.
      supabase
        .from("trips")
        .select("distance_miles, purpose")
        .eq("status", "completed")
        .gte("ended_at", weekStart.toISOString()),
    ]);

    const purposeMiles = { ...PURPOSE_MILES_EMPTY };
    for (const trip of allPurposeTrips ?? []) {
      const purpose = trip.purpose as TripPurpose;
      purposeMiles[purpose] = (purposeMiles[purpose] ?? 0) + trip.distance_miles;
    }
    setWeekMilesByPurpose(purposeMiles);

    let todayTotals = EMPTY_TOTALS;
    let weekTotals = EMPTY_TOTALS;

    for (const trip of trips ?? []) {
      const gross = (trip.earnings_usd ?? 0) + (trip.tips_usd ?? 0);
      weekTotals = accumulate(weekTotals, trip.distance_miles, gross, trip.duration_seconds);
      if (trip.ended_at && toLocalDateKey(new Date(trip.ended_at)) === todayKey) {
        todayTotals = accumulate(todayTotals, trip.distance_miles, gross, trip.duration_seconds);
      }
    }

    for (const expense of expenses ?? []) {
      weekTotals = { ...weekTotals, expensesUsd: weekTotals.expensesUsd + expense.amount_usd };
      if (expense.incurred_on === todayKey) {
        todayTotals = { ...todayTotals, expensesUsd: todayTotals.expensesUsd + expense.amount_usd };
      }
    }

    setToday(todayTotals);
    setWeek(weekTotals);
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    // Fetching from Supabase (an external system) and syncing the result
    // into state is exactly what this effect is for; the setState calls
    // inside fetchTotals happen after that async work resolves, not
    // synchronously within this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTotals();
  }, [fetchTotals, refreshSignal]);

  const vehicleCostPerMile = activeVehicleCostPerMileUsd ?? 0;
  const todayVehicleCost = today.miles * vehicleCostPerMile;
  const todayNet = today.grossUsd - today.expensesUsd - todayVehicleCost;
  const todayEarningsPerMile = today.miles > 0 ? todayNet / today.miles : 0;
  const todayEarningsPerHour =
    today.durationSeconds > 0 ? todayNet / (today.durationSeconds / 3600) : 0;

  const weekVehicleCost = week.miles * vehicleCostPerMile;
  const weekNet = week.grossUsd - week.expensesUsd - weekVehicleCost;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Visual hierarchy, most to least important: net, $/hr, $/mi, miles, vehicle cost, gross, expenses. */}
        <MetricCard
          className="sm:col-span-2 lg:col-span-3 border-0 bg-primary text-primary-foreground shadow-[0_14px_30px_-18px_rgba(15,118,110,0.7)]"
          size="hero"
          icon={<BanknoteIcon />}
          label={tm("netEarnings")}
          value={loaded ? formatUsd(todayNet, locale) : "—"}
        />
        <MetricCard
          icon={<GaugeIcon />}
          label={tm("earningsPerHour")}
          value={loaded ? formatUsdPerHour(todayEarningsPerHour, locale, hourUnitLabel) : "—"}
        />
        <MetricCard
          icon={<DollarSignIcon />}
          label={tm("earningsPerMile")}
          value={loaded ? formatUsdPerMile(todayEarningsPerMile, locale, distanceUnitLabel) : "—"}
        />
        <MetricCard
          icon={<RouteIcon />}
          label={tm("miles")}
          value={loaded ? formatMiles(today.miles, locale, distanceUnitLabel) : "—"}
        />
        <MetricCard
          icon={<CarIcon />}
          label={tm("vehicleCost")}
          value={loaded ? formatUsd(todayVehicleCost, locale) : "—"}
        />
        <MetricCard
          icon={<BanknoteIcon />}
          label={tm("grossEarnings")}
          value={loaded ? formatUsd(today.grossUsd, locale) : "—"}
        />
        <MetricCard
          icon={<ReceiptIcon />}
          label={te("title")}
          value={loaded ? formatUsd(today.expensesUsd, locale) : "—"}
        />
      </div>

      {loaded && today.tripCount === 0 ? (
        <p className="text-muted-foreground text-center text-sm">{t("noActivityToday")}</p>
      ) : null}

      {loaded && week.miles > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("mileageOverview")}</CardTitle>
            <CardDescription>{t("mileageOverviewSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-center gap-6 sm:justify-start">
            <DonutGauge
              segments={(Object.keys(weekMilesByPurpose) as TripPurpose[]).map((purpose) => ({
                value: weekMilesByPurpose[purpose],
                color: PURPOSE_COLOR[purpose],
              }))}
              centerLabel={formatMiles(week.miles, locale, distanceUnitLabel)}
              centerSublabel={tm("miles")}
            />
            <dl className="flex flex-col gap-2">
              {(Object.keys(weekMilesByPurpose) as TripPurpose[]).map((purpose) => (
                <div key={purpose} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: PURPOSE_COLOR[purpose] }}
                    aria-hidden="true"
                  />
                  <dt className="text-metric">{formatMiles(weekMilesByPurpose[purpose], locale, distanceUnitLabel)}</dt>
                  <dd className="text-muted-foreground">{tp(purpose)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("weekSummary")}</CardTitle>
          <CardDescription>{t("weekSummarySubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">{tm("netEarnings")}</dt>
              <dd className="text-metric text-lg">{loaded ? formatUsd(weekNet, locale) : "—"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">{tm("miles")}</dt>
              <dd className="text-metric text-lg">
                {loaded ? formatMiles(week.miles, locale, distanceUnitLabel) : "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">{tm("vehicleCost")}</dt>
              <dd className="text-metric text-lg">{loaded ? formatUsd(weekVehicleCost, locale) : "—"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">{tm("grossEarnings")}</dt>
              <dd className="text-metric text-lg">{loaded ? formatUsd(week.grossUsd, locale) : "—"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">{te("title")}</dt>
              <dd className="text-metric text-lg">{loaded ? formatUsd(week.expensesUsd, locale) : "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
