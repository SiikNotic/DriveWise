import { getTranslations, setRequestLocale } from "next-intl/server";
import { calculateVehicleOperatingCost } from "@drivewise/shared";

import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const tu = await getTranslations("units");

  const supabase = await createClient();
  const [{ data: claimsData }, { data: vehicles }, { data: settings }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("vehicles").select("*").order("created_at", { ascending: true }),
    supabase.from("user_settings").select("default_vehicle_id").maybeSingle(),
  ]);
  const userId = claimsData?.claims.sub ?? "";

  const activeVehicle = vehicles?.find((vehicle) => vehicle.id === settings?.default_vehicle_id) ?? null;
  const activeVehicleCostPerMileUsd = activeVehicle
    ? calculateVehicleOperatingCost({
        fuelEfficiencyMpg: activeVehicle.fuel_efficiency_mpg,
        fuelPriceUsd: activeVehicle.fuel_price_usd,
        insuranceMonthlyCostUsd: activeVehicle.insurance_monthly_cost_usd,
        maintenanceCostPerMileUsd: activeVehicle.maintenance_cost_per_mile_usd,
        depreciationCostPerMileUsd: activeVehicle.depreciation_cost_per_mile_usd,
        otherOperatingCostPerMileUsd: activeVehicle.other_operating_cost_per_mile_usd,
        estimatedMonthlyMiles: activeVehicle.estimated_monthly_miles,
      }).totalCostPerMileUsd
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <DashboardClient
        userId={userId}
        vehicles={(vehicles ?? []).map(({ id, nickname }) => ({ id, nickname }))}
        distanceUnitLabel={tu("mi")}
        hourUnitLabel={tu("hr")}
        activeVehicleCostPerMileUsd={activeVehicleCostPerMileUsd}
      />
    </div>
  );
}
