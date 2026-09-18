import type { Vehicle } from "../types/vehicle";

export interface VehicleOperatingCostBreakdown {
  fuelCostPerMileUsd: number;
  maintenanceCostPerMileUsd: number;
  depreciationCostPerMileUsd: number;
  /** Insurance's flat monthly bill, spread over the vehicle's estimated monthly miles. */
  insuranceCostPerMileUsd: number;
  otherCostPerMileUsd: number;
  totalCostPerMileUsd: number;
}

/**
 * These are operating-cost *estimates* the driver builds from their own
 * inputs — never present them as official tax/deduction figures (that's
 * `standardMileageRateUsd` in user_settings, a completely separate number
 * set by the tax authority, not derived from any of this).
 *
 * Maintenance, depreciation, and "other" are already per-mile figures the
 * driver enters directly, so there's nothing to derive — they pass through
 * unchanged. Only fuel (price ÷ efficiency) and insurance (monthly bill ÷
 * estimated monthly miles) require converting a different unit into $/mile.
 */
export function calculateVehicleOperatingCost(
  vehicle: Pick<
    Vehicle,
    | "fuelEfficiencyMpg"
    | "fuelPriceUsd"
    | "insuranceMonthlyCostUsd"
    | "maintenanceCostPerMileUsd"
    | "depreciationCostPerMileUsd"
    | "otherOperatingCostPerMileUsd"
    | "estimatedMonthlyMiles"
  >,
): VehicleOperatingCostBreakdown {
  const round = (value: number) => Number(value.toFixed(4));

  const fuelCostPerMileUsd =
    vehicle.fuelEfficiencyMpg > 0
      ? round(vehicle.fuelPriceUsd / vehicle.fuelEfficiencyMpg)
      : 0;

  const insuranceCostPerMileUsd =
    vehicle.estimatedMonthlyMiles > 0
      ? round(vehicle.insuranceMonthlyCostUsd / vehicle.estimatedMonthlyMiles)
      : 0;

  const maintenanceCostPerMileUsd = round(vehicle.maintenanceCostPerMileUsd);
  const depreciationCostPerMileUsd = round(vehicle.depreciationCostPerMileUsd);
  const otherCostPerMileUsd = round(vehicle.otherOperatingCostPerMileUsd);

  const totalCostPerMileUsd = round(
    fuelCostPerMileUsd +
      maintenanceCostPerMileUsd +
      depreciationCostPerMileUsd +
      insuranceCostPerMileUsd +
      otherCostPerMileUsd,
  );

  return {
    fuelCostPerMileUsd,
    maintenanceCostPerMileUsd,
    depreciationCostPerMileUsd,
    insuranceCostPerMileUsd,
    otherCostPerMileUsd,
    totalCostPerMileUsd,
  };
}
