/**
 * Locale-aware formatting for the numbers drivers care about most. Shared so
 * a dollar or a mile is displayed the same way on web and mobile.
 *
 * Unit abbreviations ("mi", "hr") are never hardcoded here — every unit-
 * bearing formatter takes the label as a parameter so the caller supplies it
 * from translated messages (e.g. `t("units.mi")`), per the app's "no
 * hardcoded interface text" rule.
 */

export function formatUsd(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) < 1000 ? 2 : 0,
  }).format(value);
}

export function formatUsdPerMile(
  value: number,
  locale: string,
  distanceUnitLabel: string,
): string {
  const amount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${amount}/${distanceUnitLabel}`;
}

export function formatUsdPerHour(
  value: number,
  locale: string,
  hourUnitLabel: string,
): string {
  const amount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
  return `${amount}/${hourUnitLabel}`;
}

export function formatMiles(
  value: number,
  locale: string,
  distanceUnitLabel: string,
): string {
  const amount = new Intl.NumberFormat(locale, {
    maximumFractionDigits: value < 100 ? 1 : 0,
  }).format(value);
  return `${amount} ${distanceUnitLabel}`;
}

export function formatSignedUsd(value: number, locale: string): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatUsd(value, locale)}`;
}

/** Elapsed time as h:mm:ss (or mm:ss under an hour) — locale-independent, digits read the same everywhere. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`;
}
