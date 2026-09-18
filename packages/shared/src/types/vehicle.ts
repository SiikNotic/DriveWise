export type FuelType = "gasoline" | "diesel" | "hybrid" | "electric";

export interface Vehicle {
  id: string;
  userId: string;
  clientId: string;
  nickname: string;
  make: string;
  model: string;
  year: number;
  fuelType: FuelType;
  /** Miles per gallon, or MPGe for electric vehicles. */
  fuelEfficiencyMpg: number | null;
  /** Fixed monthly costs the driver assigns to this vehicle (insurance, loan, etc). */
  monthlyFixedCostUsd: number | null;
  /** Optional manual override; when absent, cost-per-mile is derived from fuel + fixed costs. */
  costPerMileOverrideUsd: number | null;
  odometerMiles: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
