export type AppLanguage = "en" | "es";

export type DistanceUnit = "mi" | "km";

export interface UserSettings {
  userId: string;
  language: AppLanguage;
  distanceUnit: DistanceUnit;
  defaultVehicleId: string | null;
  /** IRS (or local tax authority) standard mileage rate in USD/mile, editable per tax year. */
  standardMileageRateUsd: number;
  updatedAt: string;
}
