import { describe, expect, it } from "vitest";

import { calculateVehicleOperatingCost } from "./vehicle-cost";

describe("calculateVehicleOperatingCost", () => {
  it("computes each per-mile component and sums them", () => {
    const result = calculateVehicleOperatingCost({
      fuelEfficiencyMpg: 25,
      fuelPriceUsd: 3.5,
      insuranceMonthlyCostUsd: 150,
      maintenanceCostPerMileUsd: 0.05,
      depreciationCostPerMileUsd: 0.1,
      otherOperatingCostPerMileUsd: 0.02,
      estimatedMonthlyMiles: 1000,
    });

    expect(result.fuelCostPerMileUsd).toBeCloseTo(3.5 / 25, 4);
    expect(result.insuranceCostPerMileUsd).toBeCloseTo(150 / 1000, 4);
    expect(result.maintenanceCostPerMileUsd).toBeCloseTo(0.05, 4);
    expect(result.depreciationCostPerMileUsd).toBeCloseTo(0.1, 4);
    expect(result.otherCostPerMileUsd).toBeCloseTo(0.02, 4);
    expect(result.totalCostPerMileUsd).toBeCloseTo(
      result.fuelCostPerMileUsd +
        result.insuranceCostPerMileUsd +
        result.maintenanceCostPerMileUsd +
        result.depreciationCostPerMileUsd +
        result.otherCostPerMileUsd,
      4,
    );
  });

  it("never divides by zero — fuel and insurance cost 0 when their denominators are 0", () => {
    const result = calculateVehicleOperatingCost({
      fuelEfficiencyMpg: 0,
      fuelPriceUsd: 3.5,
      insuranceMonthlyCostUsd: 150,
      maintenanceCostPerMileUsd: 0,
      depreciationCostPerMileUsd: 0,
      otherOperatingCostPerMileUsd: 0,
      estimatedMonthlyMiles: 0,
    });

    expect(result.fuelCostPerMileUsd).toBe(0);
    expect(result.insuranceCostPerMileUsd).toBe(0);
    expect(result.totalCostPerMileUsd).toBe(0);
  });
});
