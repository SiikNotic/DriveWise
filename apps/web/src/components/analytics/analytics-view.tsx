"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  BanknoteIcon,
  BriefcaseIcon,
  CarIcon,
  ClockIcon,
  DollarSignIcon,
  GaugeIcon,
  ReceiptIcon,
  RouteIcon,
} from "lucide-react";
import { formatDuration, formatMiles, formatUsd, formatUsdPerHour, formatUsdPerMile } from "@drivewise/shared";

import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, type MetricDeltaDirection } from "@/components/finance/metric-card";
import { TrendChart } from "@/components/analytics/trend-chart";
import {
  computeAnalytics,
  comparePeriods,
  type Granularity,
  type PeriodMetrics,
  type RawExpense,
  type RawTrip,
} from "@/lib/analytics/aggregate";

const FETCH_MONTHS_BACK = 7;

const COMPARISON_SUFFIX_KEY: Record<Granularity, "vsYesterday" | "vsPreviousWeek" | "vsPreviousMonth"> = {
  daily: "vsYesterday",
  weekly: "vsPreviousWeek",
  monthly: "vsPreviousMonth",
};

export function AnalyticsView({
  userId,
  activeVehicleCostPerMileUsd,
  distanceUnitLabel,
  hourUnitLabel,
}: {
  userId: string;
  activeVehicleCostPerMileUsd: number | null;
  distanceUnitLabel: string;
  hourUnitLabel: string;
}) {
  const t = useTranslations("analytics");
  const tm = useTranslations("analytics.metrics");
  const tcmp = useTranslations("analytics.comparison");
  const locale = useLocale();

  const [trips, setTrips] = useState<RawTrip[]>([]);
  const [expenses, setExpenses] = useState<RawExpense[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [granularity, setGranularity] = useState<Granularity>("daily");

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const since = new Date();
    since.setMonth(since.getMonth() - FETCH_MONTHS_BACK);
    const sinceIso = since.toISOString();
    const sinceDateKey = since.toISOString().slice(0, 10);

    void Promise.all([
      supabase
        .from("trips")
        .select("ended_at, distance_miles, duration_seconds, earnings_usd, tips_usd, purpose")
        .eq("status", "completed")
        .gte("ended_at", sinceIso),
      supabase.from("expenses").select("incurred_on, amount_usd").gte("incurred_on", sinceDateKey),
    ]).then(([{ data: tripRows }, { data: expenseRows }]) => {
      setTrips(
        (tripRows ?? [])
          .filter((row): row is typeof row & { ended_at: string } => row.ended_at !== null)
          .map((row) => ({
            endedAt: row.ended_at,
            distanceMiles: row.distance_miles,
            durationSeconds: row.duration_seconds,
            earningsUsd: row.earnings_usd,
            tipsUsd: row.tips_usd,
            purpose: row.purpose,
          })),
      );
      setExpenses((expenseRows ?? []).map((row) => ({ incurredOn: row.incurred_on, amountUsd: row.amount_usd })));
      setLoaded(true);
    });
  }, [userId]);

  const vehicleCostPerMile = activeVehicleCostPerMileUsd ?? 0;

  const data = useMemo(
    () => computeAnalytics(trips, expenses, vehicleCostPerMile, granularity, new Date(), locale),
    [trips, expenses, vehicleCostPerMile, granularity, locale],
  );

  const percentFormat = useMemo(
    () => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" }),
    [locale],
  );

  function delta(
    key: keyof PeriodMetrics,
    isIncreaseGood: boolean,
  ): { deltaLabel?: string; deltaDirection?: MetricDeltaDirection; isIncreaseGood: boolean } {
    const current = data.current[key] as number;
    const previous = data.previous[key] as number;
    const comparison = comparePeriods(current, previous);
    const suffix = tcmp(COMPARISON_SUFFIX_KEY[granularity]);

    if (comparison.kind === "none") {
      return { isIncreaseGood };
    }
    if (comparison.kind === "new") {
      return { deltaLabel: `${tcmp("new")} ${suffix}`, deltaDirection: "up", isIncreaseGood };
    }
    return {
      deltaLabel: `${percentFormat.format(comparison.value / 100)} ${suffix}`,
      deltaDirection: comparison.value > 0 ? "up" : comparison.value < 0 ? "down" : "flat",
      isIncreaseGood,
    };
  }

  const hasAnyData = trips.length > 0 || expenses.length > 0;
  const c = data.current;

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={granularity} onValueChange={(value) => setGranularity(value as Granularity)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daily">{t("tabs.daily")}</TabsTrigger>
          <TabsTrigger value="weekly">{t("tabs.weekly")}</TabsTrigger>
          <TabsTrigger value="monthly">{t("tabs.monthly")}</TabsTrigger>
        </TabsList>

        <TabsContent value={granularity} className="mt-4 flex flex-col gap-4">
          {!loaded ? (
            <p className="text-muted-foreground text-center text-sm">{t("empty.title")}</p>
          ) : !hasAnyData ? (
            <div className="flex flex-col items-center gap-1 py-12 text-center">
              <p className="font-medium">{t("empty.title")}</p>
              <p className="text-muted-foreground text-sm">{t("empty.description")}</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard
                  className="sm:col-span-2 lg:col-span-3"
                  size="hero"
                  icon={<BanknoteIcon />}
                  label={tm("netEarnings")}
                  value={formatUsd(c.netEarningsUsd, locale)}
                  {...delta("netEarningsUsd", true)}
                />
                <MetricCard
                  icon={<GaugeIcon />}
                  label={tm("earningsPerHour")}
                  value={formatUsdPerHour(c.earningsPerHourUsd, locale, hourUnitLabel)}
                  {...delta("earningsPerHourUsd", true)}
                />
                <MetricCard
                  icon={<DollarSignIcon />}
                  label={tm("netEarningsPerMile")}
                  value={formatUsdPerMile(c.netEarningsPerMileUsd, locale, distanceUnitLabel)}
                  {...delta("netEarningsPerMileUsd", true)}
                />
                <MetricCard
                  icon={<DollarSignIcon />}
                  label={tm("earningsPerMile")}
                  value={formatUsdPerMile(c.earningsPerMileUsd, locale, distanceUnitLabel)}
                  {...delta("earningsPerMileUsd", true)}
                />
                <MetricCard
                  icon={<BanknoteIcon />}
                  label={tm("grossEarnings")}
                  value={formatUsd(c.grossEarningsUsd, locale)}
                  {...delta("grossEarningsUsd", true)}
                />
                <MetricCard
                  icon={<CarIcon />}
                  label={tm("vehicleCosts")}
                  value={formatUsd(c.vehicleCostsUsd, locale)}
                  {...delta("vehicleCostsUsd", false)}
                />
                <MetricCard
                  icon={<ReceiptIcon />}
                  label={tm("totalExpenses")}
                  value={formatUsd(c.totalExpensesUsd, locale)}
                  {...delta("totalExpensesUsd", false)}
                />
                <MetricCard
                  icon={<RouteIcon />}
                  label={tm("miles")}
                  value={formatMiles(c.milesAll, locale, distanceUnitLabel)}
                  {...delta("milesAll", true)}
                />
                <MetricCard
                  icon={<BriefcaseIcon />}
                  label={tm("businessMiles")}
                  value={formatMiles(c.businessMiles, locale, distanceUnitLabel)}
                  {...delta("businessMiles", true)}
                />
                <MetricCard
                  icon={<RouteIcon />}
                  label={tm("avgTripDistance")}
                  value={formatMiles(c.avgTripDistanceMiles, locale, distanceUnitLabel)}
                  {...delta("avgTripDistanceMiles", true)}
                />
                <MetricCard
                  icon={<ClockIcon />}
                  label={tm("avgTripDuration")}
                  value={formatDuration(c.avgTripDurationSeconds)}
                  {...delta("avgTripDurationSeconds", true)}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{t("charts.netEarningsTrend")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <TrendChart
                    data={data.trend.map((point) => ({ label: point.label, value: point.netEarningsUsd }))}
                    seriesLabel={tm("netEarnings")}
                    formatValue={(value) => formatUsd(value, locale)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("charts.netPerMileTrend")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <TrendChart
                    data={data.trend.map((point) => ({ label: point.label, value: point.netEarningsPerMileUsd }))}
                    seriesLabel={tm("netEarningsPerMile")}
                    formatValue={(value) => formatUsdPerMile(value, locale, distanceUnitLabel)}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
