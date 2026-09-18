"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DownloadIcon } from "lucide-react";
import {
  calculateVehicleOperatingCost,
  formatDuration,
  formatMiles,
  formatUsd,
  formatUsdPerMile,
  type Database,
} from "@drivewise/shared";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  computeMileageReference,
  computeReportSummary,
  filterExpenses,
  filterTrips,
  type PurposeFilter,
  type ReportExpense,
  type ReportTrip,
} from "@/lib/reports/aggregate";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
type ReportTab = "mileage" | "expense" | "earnings";

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsView({
  vehicles,
  standardMileageRateUsd,
  distanceUnitLabel,
}: {
  vehicles: VehicleRow[];
  standardMileageRateUsd: number;
  distanceUnitLabel: string;
}) {
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const ts = useTranslations("reports.summary");
  const tcol = useTranslations("reports.columns");
  const tp = useTranslations("trips.purpose");
  const locale = useLocale();

  const [startDate, setStartDate] = useState(() =>
    toLocalDateKey(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)),
  );
  const [endDate, setEndDate] = useState(() => toLocalDateKey(new Date()));
  const today = toLocalDateKey(new Date());
  const [vehicleId, setVehicleId] = useState<string>("all");
  const [purpose, setPurpose] = useState<PurposeFilter>("all");
  const [tab, setTab] = useState<ReportTab>("mileage");

  const [trips, setTrips] = useState<ReportTrip[]>([]);
  const [expenses, setExpenses] = useState<ReportExpense[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Vehicle and purpose filters narrow client-side (see filterTrips/
    // filterExpenses below) — only the date range needs a fresh query.
    void Promise.all([
      supabase
        .from("trips")
        .select("vehicle_id, ended_at, distance_miles, duration_seconds, earnings_usd, tips_usd, purpose")
        .eq("status", "completed")
        .gte("ended_at", `${startDate}T00:00:00`)
        .lte("ended_at", `${endDate}T23:59:59`),
      supabase
        .from("expenses")
        .select("vehicle_id, incurred_on, amount_usd, category")
        .gte("incurred_on", startDate)
        .lte("incurred_on", endDate),
    ]).then(([{ data: tripRows }, { data: expenseRows }]) => {
      setTrips(
        (tripRows ?? [])
          .filter((row): row is typeof row & { ended_at: string } => row.ended_at !== null)
          .map((row) => ({
            vehicleId: row.vehicle_id,
            endedAt: row.ended_at,
            distanceMiles: row.distance_miles,
            durationSeconds: row.duration_seconds,
            earningsUsd: row.earnings_usd,
            tipsUsd: row.tips_usd,
            purpose: row.purpose,
          })),
      );
      setExpenses(
        (expenseRows ?? []).map((row) => ({
          vehicleId: row.vehicle_id,
          incurredOn: row.incurred_on,
          amountUsd: row.amount_usd,
          category: row.category,
        })),
      );
      setLoaded(true);
    });
  }, [startDate, endDate]);

  const vehicleCostPerMile = useMemo(() => {
    const map = new Map<string, number>();
    for (const vehicle of vehicles) {
      map.set(
        vehicle.id,
        calculateVehicleOperatingCost({
          fuelEfficiencyMpg: vehicle.fuel_efficiency_mpg,
          fuelPriceUsd: vehicle.fuel_price_usd,
          insuranceMonthlyCostUsd: vehicle.insurance_monthly_cost_usd,
          maintenanceCostPerMileUsd: vehicle.maintenance_cost_per_mile_usd,
          depreciationCostPerMileUsd: vehicle.depreciation_cost_per_mile_usd,
          otherOperatingCostPerMileUsd: vehicle.other_operating_cost_per_mile_usd,
          estimatedMonthlyMiles: vehicle.estimated_monthly_miles,
        }).totalCostPerMileUsd,
      );
    }
    return map;
  }, [vehicles]);

  const vehicleName = useMemo(() => new Map(vehicles.map((v) => [v.id, v.nickname])), [vehicles]);

  const filteredTrips = useMemo(
    () => filterTrips(trips, { startDate, endDate, vehicleId, purpose }),
    [trips, startDate, endDate, vehicleId, purpose],
  );
  const filteredExpenses = useMemo(
    () => filterExpenses(expenses, { startDate, endDate, vehicleId }),
    [expenses, startDate, endDate, vehicleId],
  );

  const summary = useMemo(
    () => computeReportSummary(filteredTrips, filteredExpenses, vehicleCostPerMile),
    [filteredTrips, filteredExpenses, vehicleCostPerMile],
  );

  const mileageReference = computeMileageReference("standard_mileage_rate", summary.businessMiles, standardMileageRateUsd);

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const hasData = filteredTrips.length > 0 || filteredExpenses.length > 0;

  function exportActiveTab() {
    if (tab === "mileage") {
      const rows = [
        [tcol("date"), tcol("vehicle"), tcol("purpose"), tcol("distance"), tcol("duration")],
        ...filteredTrips.map((trip) => [
          dateFormat.format(new Date(trip.endedAt)),
          trip.vehicleId ? (vehicleName.get(trip.vehicleId) ?? "") : "",
          tp(trip.purpose),
          String(trip.distanceMiles),
          formatDuration(trip.durationSeconds),
        ]),
      ];
      downloadCsv(`mileage-report-${startDate}-to-${endDate}.csv`, rows);
    } else if (tab === "expense") {
      const rows = [
        [tcol("date"), tcol("vehicle"), tcol("category"), tcol("amount"), tcol("description")],
        ...filteredExpenses.map((expense) => [
          expense.incurredOn,
          expense.vehicleId ? (vehicleName.get(expense.vehicleId) ?? "") : "",
          expense.category,
          String(expense.amountUsd),
          "",
        ]),
      ];
      downloadCsv(`expense-report-${startDate}-to-${endDate}.csv`, rows);
    } else {
      const businessTrips = filteredTrips.filter((trip) => trip.purpose === "business");
      const rows = [
        [tcol("date"), tcol("vehicle"), tcol("distance"), tcol("grossPay")],
        ...businessTrips.map((trip) => [
          dateFormat.format(new Date(trip.endedAt)),
          trip.vehicleId ? (vehicleName.get(trip.vehicleId) ?? "") : "",
          String(trip.distanceMiles),
          String((trip.earningsUsd ?? 0) + (trip.tipsUsd ?? 0)),
        ]),
      ];
      downloadCsv(`earnings-report-${startDate}-to-${endDate}.csv`, rows);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{tf("title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="report-start">{tf("startDate")}</Label>
            <Input
              id="report-start"
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="report-end">{tf("endDate")}</Label>
            <Input
              id="report-end"
              type="date"
              value={endDate}
              min={startDate}
              max={today}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="report-vehicle">{tf("vehicle")}</Label>
            <NativeSelect id="report-vehicle" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
              <option value="all">{tf("allVehicles")}</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.nickname}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="report-purpose">{tf("purpose")}</Label>
            <NativeSelect
              id="report-purpose"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value as PurposeFilter)}
            >
              <option value="all">{tf("allPurposes")}</option>
              <option value="business">{tp("business")}</option>
              <option value="personal">{tp("personal")}</option>
              <option value="commute">{tp("commute")}</option>
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(value) => setTab(value as ReportTab)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="mileage">{t("tabs.mileage")}</TabsTrigger>
            <TabsTrigger value="expense">{t("tabs.expense")}</TabsTrigger>
            <TabsTrigger value="earnings">{t("tabs.earnings")}</TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={exportActiveTab} disabled={!hasData}>
            <DownloadIcon />
            {t("exportCsv")}
          </Button>
        </div>

        <TabsContent value={tab} className="mt-4 flex flex-col gap-4">
          {!loaded ? (
            <p className="text-muted-foreground text-center text-sm">{t("empty.title")}</p>
          ) : !hasData ? (
            <div className="flex flex-col items-center gap-1 py-12 text-center">
              <p className="font-medium">{t("empty.title")}</p>
              <p className="text-muted-foreground text-sm">{t("empty.description")}</p>
            </div>
          ) : (
            <>
              <Card>
                <CardContent className="grid grid-cols-2 gap-y-3 pt-6 text-sm sm:grid-cols-3">
                  <dt className="text-muted-foreground">{ts("businessMiles")}</dt>
                  <dd className="col-span-1 sm:col-span-2">{formatMiles(summary.businessMiles, locale, distanceUnitLabel)}</dd>
                  <dt className="text-muted-foreground">{ts("personalMiles")}</dt>
                  <dd className="col-span-1 sm:col-span-2">{formatMiles(summary.personalMiles, locale, distanceUnitLabel)}</dd>
                  <dt className="text-muted-foreground">{ts("commuteMiles")}</dt>
                  <dd className="col-span-1 sm:col-span-2">{formatMiles(summary.commuteMiles, locale, distanceUnitLabel)}</dd>
                  <dt className="text-muted-foreground">{ts("totalExpenses")}</dt>
                  <dd className="col-span-1 sm:col-span-2">{formatUsd(summary.totalExpensesUsd, locale)}</dd>
                  <dt className="text-muted-foreground">{ts("vehicleOperatingCost")}</dt>
                  <dd className="col-span-1 sm:col-span-2">{formatUsd(summary.vehicleOperatingCostUsd, locale)}</dd>
                  <dt className="text-muted-foreground">{ts("grossEarnings")}</dt>
                  <dd className="col-span-1 sm:col-span-2">{formatUsd(summary.grossEarningsUsd, locale)}</dd>
                  <dt className="text-sm font-semibold">{ts("netEarnings")}</dt>
                  <dd className="col-span-1 font-semibold sm:col-span-2">{formatUsd(summary.netEarningsUsd, locale)}</dd>
                </CardContent>
              </Card>

              {tab === "mileage" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("mileageReference.title")}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-sm">
                      {t("mileageReference.description", {
                        rate: formatUsdPerMile(standardMileageRateUsd, locale, distanceUnitLabel),
                        amount: formatUsd(mileageReference.amountUsd, locale),
                      })}
                    </p>
                    <Alert variant="warning">
                      <AlertDescription>{t("mileageReference.disclaimer")}</AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardContent className="flex flex-col gap-2 pt-6">
                  {tab === "mileage"
                    ? filteredTrips.map((trip, index) => (
                        <div
                          key={index}
                          className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0"
                        >
                          <span>{dateFormat.format(new Date(trip.endedAt))}</span>
                          <span className="text-muted-foreground">
                            {trip.vehicleId ? vehicleName.get(trip.vehicleId) : null}
                          </span>
                          <span>{tp(trip.purpose)}</span>
                          <span className="font-mono">{formatMiles(trip.distanceMiles, locale, distanceUnitLabel)}</span>
                        </div>
                      ))
                    : null}
                  {tab === "expense"
                    ? filteredExpenses.map((expense, index) => (
                        <div
                          key={index}
                          className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0"
                        >
                          <span>{expense.incurredOn}</span>
                          <span className="text-muted-foreground">
                            {expense.vehicleId ? vehicleName.get(expense.vehicleId) : null}
                          </span>
                          <span>{expense.category}</span>
                          <span className="font-mono">{formatUsd(expense.amountUsd, locale)}</span>
                        </div>
                      ))
                    : null}
                  {tab === "earnings"
                    ? filteredTrips
                        .filter((trip) => trip.purpose === "business")
                        .map((trip, index) => (
                          <div
                            key={index}
                            className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0"
                          >
                            <span>{dateFormat.format(new Date(trip.endedAt))}</span>
                            <span className="text-muted-foreground">
                              {trip.vehicleId ? vehicleName.get(trip.vehicleId) : null}
                            </span>
                            <span className="font-mono">{formatMiles(trip.distanceMiles, locale, distanceUnitLabel)}</span>
                            <span className="font-mono">
                              {formatUsd((trip.earningsUsd ?? 0) + (trip.tipsUsd ?? 0), locale)}
                            </span>
                          </div>
                        ))
                    : null}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
