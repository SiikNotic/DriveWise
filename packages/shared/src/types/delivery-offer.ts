import type { GigPlatform } from "./trip";

export type OfferDecision = "accepted" | "declined" | "expired";

/**
 * Captures a delivery offer at decision time so the analyzer can compute a
 * net-earnings estimate before the driver accepts. Distances are entered or
 * derived from the platform's shown pickup/dropoff, plus an optional
 * estimated distance back to the driver's usual staging area and any
 * additional wait time (e.g. at a restaurant) beyond the platform's own
 * estimate.
 */
export interface DeliveryOffer {
  id: string;
  userId: string;
  clientId: string;
  vehicleId: string | null;
  platform: GigPlatform;
  offeredPayUsd: number;
  estimatedDistanceMiles: number;
  estimatedDurationMinutes: number;
  estimatedReturnDistanceMiles: number | null;
  additionalWaitMinutes: number | null;
  decision: OfferDecision;
  linkedTripId: string | null;
  createdAt: string;
}

/**
 * A transparent, multi-factor breakdown of an offer — deliberately not a
 * single collapsed score. `meetsHourlyTarget` and `meetsPerMileTarget` are
 * independent booleans (not a single `isWorthIt` verdict) so a driver can
 * see, for example, that an offer clears their per-mile bar but misses
 * their hourly one. This is data for the driver to weigh, not a
 * recommendation — the UI must never present it as an absolute verdict.
 */
export interface OfferAnalysis {
  grossPayoutUsd: number;
  totalMiles: number;
  totalMinutes: number;
  vehicleCostUsd: number;
  estimatedNetUsd: number;
  grossEarningsPerMileUsd: number;
  netEarningsPerMileUsd: number;
  estimatedGrossHourlyUsd: number;
  estimatedNetHourlyUsd: number;
  meetsHourlyTarget: boolean;
  meetsPerMileTarget: boolean;
}
