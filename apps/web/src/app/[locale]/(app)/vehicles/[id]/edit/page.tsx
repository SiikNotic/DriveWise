import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VehicleForm } from "@/components/vehicles/vehicle-form";

export default async function EditVehiclePage(props: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("vehicles");

  const supabase = await createClient();
  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();

  if (!vehicle) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("editTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("editSubtitle")}</p>
      </div>

      <Card>
        <CardHeader className="sr-only">
          <CardTitle>{t("editTitle")}</CardTitle>
          <CardDescription>{t("editSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <VehicleForm
            mode="edit"
            vehicleId={vehicle.id}
            defaultValues={{
              nickname: vehicle.nickname,
              make: vehicle.make,
              model: vehicle.model,
              year: String(vehicle.year),
              trim: vehicle.trim ?? "",
              fuelType: vehicle.fuel_type,
              fuelEfficiencyMpg: String(vehicle.fuel_efficiency_mpg),
              fuelPriceUsd: String(vehicle.fuel_price_usd),
              insuranceMonthlyCostUsd: String(vehicle.insurance_monthly_cost_usd),
              maintenanceCostPerMileUsd: String(vehicle.maintenance_cost_per_mile_usd),
              depreciationCostPerMileUsd: String(vehicle.depreciation_cost_per_mile_usd),
              otherOperatingCostPerMileUsd: String(vehicle.other_operating_cost_per_mile_usd),
              estimatedMonthlyMiles: String(vehicle.estimated_monthly_miles),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
