import type { Vehicle } from "../types/vehicle";

export interface VehicleCostInput {
  vehicle: Pick<
    Vehicle,
    "fuelEfficiencyMpg" | "monthlyFixedCostUsd" | "costPerMileOverrideUsd"
  >;
  fuelPriceUsdPerGallon: number;
  /** Assumed monthly business miles, used to spread fixed costs per mile. */
  estimatedMonthlyBusinessMiles: number;
}

/**
 * Cost per mile combines variable fuel cost with fixed costs (insurance,
 * loan/lease payment) spread over the driver's estimated monthly mileage.
 * A manual override always wins, since some drivers prefer a flat estimate.
 */
export function calculateCostPerMileUsd(input: VehicleCostInput): number {
  const { vehicle, fuelPriceUsdPerGallon, estimatedMonthlyBusinessMiles } = input;

  if (vehicle.costPerMileOverrideUsd !== null) {
    return vehicle.costPerMileOverrideUsd;
  }

  const fuelCostPerMile =
    vehicle.fuelEfficiencyMpg && vehicle.fuelEfficiencyMpg > 0
      ? fuelPriceUsdPerGallon / vehicle.fuelEfficiencyMpg
      : 0;

  const fixedCostPerMile =
    vehicle.monthlyFixedCostUsd && estimatedMonthlyBusinessMiles > 0
      ? vehicle.monthlyFixedCostUsd / estimatedMonthlyBusinessMiles
      : 0;

  return Number((fuelCostPerMile + fixedCostPerMile).toFixed(4));
}
