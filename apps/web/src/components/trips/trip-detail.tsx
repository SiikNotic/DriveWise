"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import {
  calculateVehicleOperatingCost,
  formatDuration,
  formatMiles,
  formatUsd,
  type Database,
  type TripPurpose,
} from "@drivewise/shared";

import { useRouter } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge";
import { TripRouteMap } from "@/components/trips/trip-route-map";
import { fetchTripDetail, updateTripPurpose, deleteTripRecord, type TripDetail as TripDetailData } from "@/lib/trips/trip-source";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

const SYNC_TONE: Record<string, StatusTone> = {
  local: "neutral",
  pending: "warning",
  syncing: "warning",
  synced: "positive",
  failed: "serious",
};

const PURPOSES: TripPurpose[] = ["business", "personal", "commute"];

export function TripDetail({
  clientId,
  userId,
  vehicles,
  distanceUnitLabel,
  hourUnitLabel,
}: {
  clientId: string;
  userId: string;
  vehicles: VehicleRow[];
  distanceUnitLabel: string;
  hourUnitLabel: string;
}) {
  const t = useTranslations("trips");
  const tf = useTranslations("trips.fields");
  const tc = useTranslations("common");
  const tn = useTranslations("notifications");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();

  const [data, setData] = useState<TripDetailData | null | undefined>(undefined);
  const [savingPurpose, setSavingPurpose] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchTripDetail(clientId, userId).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, userId]);

  async function handlePurposeChange(event: React.ChangeEvent<HTMLSelectElement>) {
    if (!data) return;
    const purpose = event.target.value as TripPurpose;
    setSavingPurpose(true);
    const result = await updateTripPurpose(data.row, purpose);
    setSavingPurpose(false);
    if (result.error) {
      toast(result.error);
      return;
    }
    setData({ ...data, row: { ...data.row, purpose } });
    toast(tn("tripUpdated"));
  }

  async function handleDelete() {
    if (!data) return;
    setDeleting(true);
    const result = await deleteTripRecord(data.row);
    setDeleting(false);
    setConfirmOpen(false);
    if (result.error) {
      toast(result.error);
      return;
    }
    toast(tn("tripDeleted"));
    router.push("/trips");
  }

  if (data === undefined) {
    return <p className="text-muted-foreground text-center text-sm">{t("empty.title")}</p>;
  }

  if (data === null) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-muted-foreground text-sm">{te("notFound")}</p>
      </div>
    );
  }

  const { row, points } = data;
  const started = new Date(row.startedAt);
  const ended = row.endedAt ? new Date(row.endedAt) : null;
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const hours = row.durationSeconds / 3600;
  const averageSpeedMph = hours > 0 ? row.distanceMiles / hours : null;
  const businessMiles = row.purpose === "business" ? row.distanceMiles : 0;

  const vehicle = vehicles.find((v) => v.id === row.vehicleId) ?? null;
  const vehicleCostPerMile = vehicle
    ? calculateVehicleOperatingCost({
        fuelEfficiencyMpg: vehicle.fuel_efficiency_mpg,
        fuelPriceUsd: vehicle.fuel_price_usd,
        insuranceMonthlyCostUsd: vehicle.insurance_monthly_cost_usd,
        maintenanceCostPerMileUsd: vehicle.maintenance_cost_per_mile_usd,
        depreciationCostPerMileUsd: vehicle.depreciation_cost_per_mile_usd,
        otherOperatingCostPerMileUsd: vehicle.other_operating_cost_per_mile_usd,
        estimatedMonthlyMiles: vehicle.estimated_monthly_miles,
      }).totalCostPerMileUsd
    : null;
  const estimatedVehicleCostUsd = vehicleCostPerMile !== null ? vehicleCostPerMile * row.distanceMiles : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{dateFormat.format(started)}</h1>
          <p className="text-muted-foreground text-sm">
            {timeFormat.format(started)}
            {ended ? ` – ${timeFormat.format(ended)}` : ""}
          </p>
        </div>
        <StatusBadge tone={SYNC_TONE[row.syncStatus]}>{t(`syncStatus.${row.syncStatus}`)}</StatusBadge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("route.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {points.length >= 2 ? (
            <TripRouteMap points={points} />
          ) : (
            <p className="text-muted-foreground text-sm">{t("route.empty")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <dl className="grid grid-cols-2 gap-y-3 text-sm sm:grid-cols-3">
            <dt className="text-muted-foreground">{tf("distance")}</dt>
            <dd className="col-span-1 sm:col-span-2">{formatMiles(row.distanceMiles, locale, distanceUnitLabel)}</dd>

            <dt className="text-muted-foreground">{tf("duration")}</dt>
            <dd className="col-span-1 sm:col-span-2">{formatDuration(row.durationSeconds)}</dd>

            <dt className="text-muted-foreground">{tf("averageSpeed")}</dt>
            <dd className="col-span-1 sm:col-span-2">
              {averageSpeedMph !== null
                ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(averageSpeedMph)} ${distanceUnitLabel}/${hourUnitLabel}`
                : "—"}
            </dd>

            <dt className="text-muted-foreground">{tf("startTime")}</dt>
            <dd className="col-span-1 sm:col-span-2">{timeFormat.format(started)}</dd>

            <dt className="text-muted-foreground">{tf("endTime")}</dt>
            <dd className="col-span-1 sm:col-span-2">{ended ? timeFormat.format(ended) : "—"}</dd>

            <dt className="text-muted-foreground">{tf("vehicle")}</dt>
            <dd className="col-span-1 sm:col-span-2">{vehicle?.nickname ?? t("noVehicle")}</dd>

            <dt className="text-muted-foreground">{tf("estimatedVehicleCost")}</dt>
            <dd className="col-span-1 sm:col-span-2">
              {estimatedVehicleCostUsd !== null ? formatUsd(estimatedVehicleCostUsd, locale) : "—"}
            </dd>

            <dt className="text-muted-foreground">{tf("businessMiles")}</dt>
            <dd className="col-span-1 sm:col-span-2">{formatMiles(businessMiles, locale, distanceUnitLabel)}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tf("purpose")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid max-w-56 gap-1.5">
            <Label htmlFor="trip-purpose">{tf("purpose")}</Label>
            <NativeSelect
              id="trip-purpose"
              value={row.purpose}
              disabled={savingPurpose}
              onChange={handlePurposeChange}
            >
              {PURPOSES.map((value) => (
                <option key={value} value={value}>
                  {t(`purpose.${value}`)}
                </option>
              ))}
            </NativeSelect>
          </div>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive w-fit">
                <Trash2Icon />
                {tc("delete")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("deleteConfirm.title")}</DialogTitle>
                <DialogDescription>{t("deleteConfirm.description")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{tc("cancel")}</Button>
                </DialogClose>
                <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                  {tc("delete")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
