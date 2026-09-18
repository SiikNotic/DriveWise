import type { OfferAnalysis } from "../types/delivery-offer";

export interface OfferAnalyzerInput {
  offeredPayUsd: number;
  estimatedDistanceMiles: number;
  estimatedDurationMinutes: number;
  /** Distance back to the driver's staging area, if it's out of the way. */
  estimatedReturnDistanceMiles: number | null;
  costPerMileUsd: number;
  /** Below this hourly rate, the offer is flagged as not worth accepting. */
  minAcceptableHourlyRateUsd: number;
}

/**
 * Core "is this offer worth it" calculation shared by web and mobile:
 * pay minus vehicle cost over total driving distance (including the
 * optional deadhead/return leg), expressed as net earnings and $/hour.
 */
export function analyzeDeliveryOffer(input: OfferAnalyzerInput): OfferAnalysis {
  const {
    offeredPayUsd,
    estimatedDistanceMiles,
    estimatedDurationMinutes,
    estimatedReturnDistanceMiles,
    costPerMileUsd,
    minAcceptableHourlyRateUsd,
  } = input;

  const totalDistanceMiles =
    estimatedDistanceMiles + (estimatedReturnDistanceMiles ?? 0);

  const vehicleCostUsd = Number((totalDistanceMiles * costPerMileUsd).toFixed(2));
  const estimatedNetEarningsUsd = Number(
    (offeredPayUsd - vehicleCostUsd).toFixed(2),
  );

  const hours = estimatedDurationMinutes / 60;
  const effectiveHourlyRateUsd =
    hours > 0 ? Number((estimatedNetEarningsUsd / hours).toFixed(2)) : 0;

  const netEarningsPerMileUsd =
    totalDistanceMiles > 0
      ? Number((estimatedNetEarningsUsd / totalDistanceMiles).toFixed(2))
      : 0;

  return {
    totalDistanceMiles,
    vehicleCostUsd,
    estimatedNetEarningsUsd,
    effectiveHourlyRateUsd,
    netEarningsPerMileUsd,
    isWorthIt: effectiveHourlyRateUsd >= minAcceptableHourlyRateUsd,
  };
}
