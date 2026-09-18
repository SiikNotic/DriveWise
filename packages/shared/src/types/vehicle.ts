export type FuelType = "gasoline" | "diesel" | "hybrid" | "electric";

export interface Vehicle {
  id: string;
  userId: string;
  clientId: string;
  nickname: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  fuelType: FuelType;
  /** Miles per gallon, or MPGe for electric vehicles. */
  fuelEfficiencyMpg: number;
  /** Price per gallon (or per kWh for electric). */
  fuelPriceUsd: number;
  insuranceMonthlyCostUsd: number;
  maintenanceCostPerMileUsd: number;
  depreciationCostPerMileUsd: number;
  otherOperatingCostPerMileUsd: number;
  /** Assumed monthly mileage, used only to spread insurance's monthly cost per mile. */
  estimatedMonthlyMiles: number;
  odometerMiles: number | null;
  createdAt: string;
  updatedAt: string;
}
