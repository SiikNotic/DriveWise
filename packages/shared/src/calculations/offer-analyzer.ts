import type { OfferAnalysis } from "../types/delivery-offer";

export interface OfferAnalyzerInput {
  offeredPayUsd: number;
  estimatedDistanceMiles: number;
  estimatedDurationMinutes: number;
  /** Distance back to the driver's staging area, if it's out of the way. */
  estimatedReturnDistanceMiles: number | null;
  /** Extra wait time (e.g. at the restaurant) beyond the platform's own time estimate. */
  additionalWaitMinutes: number | null;
  /** The active vehicle's total operating cost per mile — see calculateVehicleOperatingCost. */
  costPerMileUsd: number;
  /** Driver-configurable minimum acceptable net $/hour. */
  minHourlyEarningsUsd: number;
  /** Driver-configurable minimum acceptable net $/mile. */
  minPerMileEarningsUsd: number;
}

/**
 * Core "what is this offer actually worth" calculation shared by web and
 * mobile. Deliberately produces a full, transparent breakdown rather than a
 * single collapsed number: gross and net are both shown per-mile *and*
 * per-hour, and the two threshold comparisons are independent booleans, not
 * one merged verdict. This function never decides whether to accept an
 * offer — it only surfaces the factors a driver would want when deciding.
 */
export function analyzeDeliveryOffer(input: OfferAnalyzerInput): OfferAnalysis {
  const {
    offeredPayUsd,
    estimatedDistanceMiles,
    estimatedDurationMinutes,
    estimatedReturnDistanceMiles,
    additionalWaitMinutes,
    costPerMileUsd,
    minHourlyEarningsUsd,
    minPerMileEarningsUsd,
  } = input;

  const round2 = (value: number) => Number(value.toFixed(2));

  const totalMiles = estimatedDistanceMiles + (estimatedReturnDistanceMiles ?? 0);
  const totalMinutes = estimatedDurationMinutes + (additionalWaitMinutes ?? 0);
  const hours = totalMinutes / 60;

  const vehicleCostUsd = round2(totalMiles * costPerMileUsd);
  const estimatedNetUsd = round2(offeredPayUsd - vehicleCostUsd);

  const grossEarningsPerMileUsd = totalMiles > 0 ? round2(offeredPayUsd / totalMiles) : 0;
  const netEarningsPerMileUsd = totalMiles > 0 ? round2(estimatedNetUsd / totalMiles) : 0;

  const estimatedGrossHourlyUsd = hours > 0 ? round2(offeredPayUsd / hours) : 0;
  const estimatedNetHourlyUsd = hours > 0 ? round2(estimatedNetUsd / hours) : 0;

  return {
    grossPayoutUsd: round2(offeredPayUsd),
    totalMiles,
    totalMinutes,
    vehicleCostUsd,
    estimatedNetUsd,
    grossEarningsPerMileUsd,
    netEarningsPerMileUsd,
    estimatedGrossHourlyUsd,
    estimatedNetHourlyUsd,
    meetsHourlyTarget: estimatedNetHourlyUsd >= minHourlyEarningsUsd,
    meetsPerMileTarget: netEarningsPerMileUsd >= minPerMileEarningsUsd,
  };
}
