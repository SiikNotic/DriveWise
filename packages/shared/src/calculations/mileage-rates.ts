/**
 * IRS standard mileage rate (USD/mile) for business use of a vehicle, by tax
 * year. Users can override this in Settings; these are just sane defaults so
 * tax mileage reports work out of the box. Source values must be updated
 * manually each year from published IRS guidance — never invented at runtime.
 */
export const IRS_STANDARD_MILEAGE_RATE_USD: Record<number, number> = {
  2023: 0.655,
  2024: 0.67,
  2025: 0.7,
};

export function getStandardMileageRate(year: number): number {
  const knownYears = Object.keys(IRS_STANDARD_MILEAGE_RATE_USD)
    .map(Number)
    .sort((a, b) => a - b);
  const fallbackYear = knownYears[knownYears.length - 1];
  return (
    IRS_STANDARD_MILEAGE_RATE_USD[year] ??
    (fallbackYear !== undefined ? IRS_STANDARD_MILEAGE_RATE_USD[fallbackYear] : 0)
  ) as number;
}
