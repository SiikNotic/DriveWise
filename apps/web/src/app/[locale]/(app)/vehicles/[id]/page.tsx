import { notFound } from "next/navigation";
import { PencilIcon, CheckCircle2Icon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { calculateVehicleOperatingCost, formatMiles, formatUsd, formatUsdPerMile } from "@drivewise/shared";

import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/finance/metric-card";
import { CostBreakdown } from "@/components/vehicles/cost-breakdown";
import { DeleteVehicleDialog } from "@/components/vehicles/delete-vehicle-dialog";
import { SetActiveVehicleButton } from "@/components/vehicles/set-active-vehicle-button";

export default async function VehicleDetailsPage(props: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("vehicles");
  const tf = await getTranslations("vehicles.fields");
  const tu = await getTranslations("units");
  const mi = tu("mi");

  const supabase = await createClient();
  const [{ data: vehicle }, { data: settings }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).maybeSingle(),
    supabase.from("user_settings").select("default_vehicle_id").maybeSingle(),
  ]);

  if (!vehicle) {
    notFound();
  }

  const isActive = settings?.default_vehicle_id === vehicle.id;

  const breakdown = calculateVehicleOperatingCost({
    fuelEfficiencyMpg: vehicle.fuel_efficiency_mpg,
    fuelPriceUsd: vehicle.fuel_price_usd,
    insuranceMonthlyCostUsd: vehicle.insurance_monthly_cost_usd,
    maintenanceCostPerMileUsd: vehicle.maintenance_cost_per_mile_usd,
    depreciationCostPerMileUsd: vehicle.depreciation_cost_per_mile_usd,
    otherOperatingCostPerMileUsd: vehicle.other_operating_cost_per_mile_usd,
    estimatedMonthlyMiles: vehicle.estimated_monthly_miles,
  });

  return (
    <div className="flex flex-col gap-6">
      <Link href="/vehicles" className="text-muted-foreground w-fit text-sm hover:underline">
        &larr; {t("detailsBack")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{vehicle.nickname}</h1>
            {isActive ? (
              <Badge variant="positive">
                <CheckCircle2Icon />
                {t("active")}
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm">
            {vehicle.year} {vehicle.make} {vehicle.model}
            {vehicle.trim ? ` ${vehicle.trim}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isActive ? <SetActiveVehicleButton vehicleId={vehicle.id} /> : null}
          <Button variant="outline" asChild>
            <Link href={`/vehicles/${vehicle.id}/edit`}>
              <PencilIcon />
              {t("editTitle")}
            </Link>
          </Button>
          <DeleteVehicleDialog vehicleId={vehicle.id} />
        </div>
      </div>

      <MetricCard
        size="hero"
        label={t("cost.total")}
        value={formatUsdPerMile(breakdown.totalCostPerMileUsd, locale, mi)}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CostBreakdown breakdown={breakdown} locale={locale} distanceUnitLabel={mi} />

        <Card>
          <CardHeader>
            <CardTitle>{t("vehicleInfo")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">{tf("fuelType")}</dt>
              <dd>{t(`fuelType.${vehicle.fuel_type}`)}</dd>
              <dt className="text-muted-foreground">{tf("fuelEfficiency")}</dt>
              <dd>{vehicle.fuel_efficiency_mpg}</dd>
              <dt className="text-muted-foreground">{tf("fuelPrice")}</dt>
              <dd>{formatUsd(vehicle.fuel_price_usd, locale)}</dd>
              <dt className="text-muted-foreground">{tf("insuranceMonthlyCost")}</dt>
              <dd>{formatUsd(vehicle.insurance_monthly_cost_usd, locale)}</dd>
              <dt className="text-muted-foreground">{tf("estimatedMonthlyMiles")}</dt>
              <dd>{formatMiles(vehicle.estimated_monthly_miles, locale, mi)}</dd>
              {vehicle.odometer_miles !== null ? (
                <>
                  <dt className="text-muted-foreground">{tf("odometer")}</dt>
                  <dd>{formatMiles(vehicle.odometer_miles, locale, mi)}</dd>
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
