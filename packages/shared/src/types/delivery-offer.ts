import type { GigPlatform } from "./trip";

export type OfferDecision = "accepted" | "declined" | "expired";

/**
 * Captures a delivery offer at decision time so the analyzer can compute a
 * net-earnings estimate before the driver accepts. Distances are entered or
 * derived from the platform's shown pickup/dropoff, plus an optional
 * estimated distance back to the driver's usual staging area.
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
  decision: OfferDecision;
  linkedTripId: string | null;
  createdAt: string;
}

export interface OfferAnalysis {
  totalDistanceMiles: number;
  vehicleCostUsd: number;
  estimatedNetEarningsUsd: number;
  effectiveHourlyRateUsd: number;
  netEarningsPerMileUsd: number;
  isWorthIt: boolean;
}
