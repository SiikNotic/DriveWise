export interface VehicleActionState {
  error?: string;
  success?: boolean;
}

export const initialVehicleActionState: VehicleActionState = {};

export const FUEL_TYPES = ["gasoline", "diesel", "hybrid", "electric"] as const;
export type FuelTypeValue = (typeof FUEL_TYPES)[number];

export function isFuelType(value: string): value is FuelTypeValue {
  return (FUEL_TYPES as readonly string[]).includes(value);
}

export const MIN_VEHICLE_YEAR = 1980;
export const MAX_VEHICLE_YEAR = 2100;
