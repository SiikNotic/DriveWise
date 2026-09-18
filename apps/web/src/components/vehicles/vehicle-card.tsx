import { CarIcon, CheckCircle2Icon } from "lucide-react";
import { calculateVehicleOperatingCost, formatUsdPerMile } from "@drivewise/shared";
import type { Database } from "@drivewise/shared";

import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

export function VehicleCard({
  vehicle,
  isActive,
  locale,
  distanceUnitLabel,
  activeLabel,
}: {
  vehicle: VehicleRow;
  isActive: boolean;
  locale: string;
  distanceUnitLabel: string;
  activeLabel: string;
}) {
  const { totalCostPerMileUsd } = calculateVehicleOperatingCost({
    fuelEfficiencyMpg: vehicle.fuel_efficiency_mpg,
    fuelPriceUsd: vehicle.fuel_price_usd,
    insuranceMonthlyCostUsd: vehicle.insurance_monthly_cost_usd,
    maintenanceCostPerMileUsd: vehicle.maintenance_cost_per_mile_usd,
    depreciationCostPerMileUsd: vehicle.depreciation_cost_per_mile_usd,
    otherOperatingCostPerMileUsd: vehicle.other_operating_cost_per_mile_usd,
    estimatedMonthlyMiles: vehicle.estimated_monthly_miles,
  });

  return (
    <Link href={`/vehicles/${vehicle.id}`} className="block">
      <Card className="gap-3 py-4 transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full">
              <CarIcon className="text-secondary-foreground size-5" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{vehicle.nickname}</span>
                {isActive ? (
                  <Badge variant="positive">
                    <CheckCircle2Icon />
                    {activeLabel}
                  </Badge>
                ) : null}
              </div>
              <span className="text-muted-foreground truncate text-sm">
                {vehicle.year} {vehicle.make} {vehicle.model}
                {vehicle.trim ? ` ${vehicle.trim}` : ""}
              </span>
            </div>
          </div>
          <span className="text-metric shrink-0 text-lg">
            {formatUsdPerMile(totalCostPerMileUsd, locale, distanceUnitLabel)}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
