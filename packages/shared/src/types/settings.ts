export type AppLanguage = "en" | "es";

export type DistanceUnit = "mi" | "km";

export interface UserSettings {
  userId: string;
  language: AppLanguage;
  distanceUnit: DistanceUnit;
  defaultVehicleId: string | null;
  /** IRS (or local tax authority) standard mileage rate in USD/mile, editable per tax year. */
  standardMileageRateUsd: number;
  /** Driver-configurable minimum acceptable net $/hour — one factor among several in the Offer Analyzer, never a sole verdict. */
  minHourlyEarningsUsd: number;
  /** Driver-configurable minimum acceptable net $/mile — one factor among several in the Offer Analyzer, never a sole verdict. */
  minPerMileEarningsUsd: number;
  updatedAt: string;
}
