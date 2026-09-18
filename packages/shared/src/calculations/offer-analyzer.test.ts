import { describe, expect, it } from "vitest";

import { analyzeDeliveryOffer } from "./offer-analyzer";

describe("analyzeDeliveryOffer", () => {
  // The task's own worked example: $9.50 offer, 4.2mi delivery + 2mi return,
  // 28 min, $0.47/mi vehicle cost -> $2.91 vehicle cost, $6.59 net.
  it("matches the spec's worked example exactly", () => {
    const result = analyzeDeliveryOffer({
      offeredPayUsd: 9.5,
      estimatedDistanceMiles: 4.2,
      estimatedDurationMinutes: 28,
      estimatedReturnDistanceMiles: 2,
      additionalWaitMinutes: null,
      costPerMileUsd: 0.47,
      minHourlyEarningsUsd: 20,
      minPerMileEarningsUsd: 1,
    });

    expect(result.totalMiles).toBeCloseTo(6.2, 4);
    expect(result.vehicleCostUsd).toBeCloseTo(2.91, 2);
    expect(result.estimatedNetUsd).toBeCloseTo(6.59, 2);
  });

  it("never collapses to a single verdict — the two targets are independent", () => {
    // Clears the per-mile bar but not the hourly one: a long, cheap-per-mile
    // but slow offer.
    const result = analyzeDeliveryOffer({
      offeredPayUsd: 20,
      estimatedDistanceMiles: 10,
      estimatedDurationMinutes: 120,
      estimatedReturnDistanceMiles: null,
      additionalWaitMinutes: null,
      costPerMileUsd: 0.3,
      minHourlyEarningsUsd: 20,
      minPerMileEarningsUsd: 1,
    });

    expect(result.meetsPerMileTarget).toBe(true);
    expect(result.meetsHourlyTarget).toBe(false);
  });

  it("returns zero rates instead of dividing by zero when miles or time are absent", () => {
    const result = analyzeDeliveryOffer({
      offeredPayUsd: 10,
      estimatedDistanceMiles: 0,
      estimatedDurationMinutes: 0,
      estimatedReturnDistanceMiles: null,
      additionalWaitMinutes: null,
      costPerMileUsd: 0.5,
      minHourlyEarningsUsd: 20,
      minPerMileEarningsUsd: 1,
    });

    expect(result.grossEarningsPerMileUsd).toBe(0);
    expect(result.estimatedGrossHourlyUsd).toBe(0);
  });
});
