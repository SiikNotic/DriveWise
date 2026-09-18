import type { TripPurpose } from "@drivewise/shared";

export interface ReportTrip {
  vehicleId: string | null;
  endedAt: string;
  distanceMiles: number;
  durationSeconds: number;
  earningsUsd: number | null;
  tipsUsd: number | null;
  purpose: TripPurpose;
}

export interface ReportExpense {
  vehicleId: string | null;
  incurredOn: string;
  amountUsd: number;
  category: string;
}

export type PurposeFilter = TripPurpose | "all";

export interface ReportFilters {
  /** Inclusive, "YYYY-MM-DD", the driver's local calendar day. */
  startDate: string;
  endDate: string;
  vehicleId: string | "all";
  purpose: PurposeFilter;
}

export interface ReportSummary {
  businessMiles: number;
  personalMiles: number;
  commuteMiles: number;
  totalExpensesUsd: number;
  /** Business-trip-scoped, same convention as the Dashboard and Analytics — see README. */
  vehicleOperatingCostUsd: number;
  grossEarningsUsd: number;
  netEarningsUsd: number;
  tripCount: number;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function filterTrips(trips: ReportTrip[], filters: ReportFilters): ReportTrip[] {
  return trips.filter((trip) => {
    const dateKey = toLocalDateKey(new Date(trip.endedAt));
    if (dateKey < filters.startDate || dateKey > filters.endDate) return false;
    if (filters.vehicleId !== "all" && trip.vehicleId !== filters.vehicleId) return false;
    if (filters.purpose !== "all" && trip.purpose !== filters.purpose) return false;
    return true;
  });
}

export function filterExpenses(
  expenses: ReportExpense[],
  filters: Pick<ReportFilters, "startDate" | "endDate" | "vehicleId">,
): ReportExpense[] {
  return expenses.filter((expense) => {
    if (expense.incurredOn < filters.startDate || expense.incurredOn > filters.endDate) return false;
    if (filters.vehicleId !== "all" && expense.vehicleId !== filters.vehicleId) return false;
    return true;
  });
}

/**
 * All totals come from the same filtered set — picking "Business" in the
 * purpose filter correctly zeroes out Personal/Commute miles rather than
 * computing a second, differently-filtered set behind the scenes. Vehicle
 * operating cost stays scoped to business trips (matching the Dashboard's
 * and Analytics' existing convention) since it's what's subtracted for net
 * earnings; a personal or commute trip has no earnings to net it against.
 */
export function computeReportSummary(
  trips: ReportTrip[],
  expenses: ReportExpense[],
  vehicleCostPerMileUsd: Map<string, number>,
): ReportSummary {
  let businessMiles = 0;
  let personalMiles = 0;
  let commuteMiles = 0;
  let grossEarningsUsd = 0;
  let vehicleOperatingCostUsd = 0;

  for (const trip of trips) {
    if (trip.purpose === "business") {
      businessMiles += trip.distanceMiles;
      grossEarningsUsd += (trip.earningsUsd ?? 0) + (trip.tipsUsd ?? 0);
      const costPerMile = trip.vehicleId ? (vehicleCostPerMileUsd.get(trip.vehicleId) ?? 0) : 0;
      vehicleOperatingCostUsd += trip.distanceMiles * costPerMile;
    } else if (trip.purpose === "personal") {
      personalMiles += trip.distanceMiles;
    } else {
      commuteMiles += trip.distanceMiles;
    }
  }

  const totalExpensesUsd = expenses.reduce((sum, expense) => sum + expense.amountUsd, 0);
  const netEarningsUsd = grossEarningsUsd - totalExpensesUsd - vehicleOperatingCostUsd;

  return {
    businessMiles,
    personalMiles,
    commuteMiles,
    totalExpensesUsd,
    vehicleOperatingCostUsd,
    grossEarningsUsd,
    netEarningsUsd,
    tripCount: trips.length,
  };
}

/**
 * Deliberately just one method today (a plain rate × business-miles
 * reference figure) — never presented as a certified deduction, see the
 * disclaimer wherever this is shown. Structured as a method union so a
 * future "actual expenses" method (business-use % × real vehicle costs)
 * can be added by extending the switch, without changing any caller.
 */
export type MileageReferenceMethod = "standard_mileage_rate";

export interface MileageReference {
  method: MileageReferenceMethod;
  amountUsd: number;
}

export function computeMileageReference(
  method: MileageReferenceMethod,
  businessMiles: number,
  standardMileageRateUsd: number,
): MileageReference {
  switch (method) {
    case "standard_mileage_rate":
      return { method, amountUsd: businessMiles * standardMileageRateUsd };
  }
}
