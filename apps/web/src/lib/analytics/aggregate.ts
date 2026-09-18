import type { TripPurpose } from "@drivewise/shared";

export type Granularity = "daily" | "weekly" | "monthly";

export interface RawTrip {
  endedAt: string;
  distanceMiles: number;
  durationSeconds: number;
  earningsUsd: number | null;
  tipsUsd: number | null;
  purpose: TripPurpose;
}

export interface RawExpense {
  incurredOn: string;
  amountUsd: number;
}

export interface PeriodMetrics {
  grossEarningsUsd: number;
  netEarningsUsd: number;
  totalExpensesUsd: number;
  vehicleCostsUsd: number;
  milesAll: number;
  businessMiles: number;
  earningsPerMileUsd: number;
  netEarningsPerMileUsd: number;
  earningsPerHourUsd: number;
  avgTripDistanceMiles: number;
  avgTripDurationSeconds: number;
  tripCount: number;
}

export interface TrendPoint {
  label: string;
  netEarningsUsd: number;
  netEarningsPerMileUsd: number;
}

export interface GranularityData {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  trend: TrendPoint[];
}

interface DateRange {
  start: Date;
  end: Date;
}

function inRange(date: Date, range: DateRange): boolean {
  return date >= range.start && date < range.end;
}

/** Parsed at local midnight — `incurred_on` is a bare SQL date with no timezone, so this must never go through UTC. */
function parseLocalDate(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

/**
 * The two "activity" metrics (miles, average trip distance/duration) count
 * every completed trip regardless of purpose — that's how far the driver
 * actually drove. Everything earnings/cost-related (gross/net, vehicle
 * cost, business miles, the $/mile and $/hour rates) is scoped to business
 * trips only, matching the Dashboard's existing convention: a personal or
 * commute trip has no gig pay to count and shouldn't dilute the cost/rate
 * math either.
 */
export function computeMetrics(
  trips: RawTrip[],
  expenses: RawExpense[],
  vehicleCostPerMileUsd: number,
): PeriodMetrics {
  let grossEarningsUsd = 0;
  let businessMiles = 0;
  let businessDurationSeconds = 0;
  let milesAll = 0;
  let durationAll = 0;
  let tripCount = 0;

  for (const trip of trips) {
    milesAll += trip.distanceMiles;
    durationAll += trip.durationSeconds;
    tripCount += 1;
    if (trip.purpose === "business") {
      grossEarningsUsd += (trip.earningsUsd ?? 0) + (trip.tipsUsd ?? 0);
      businessMiles += trip.distanceMiles;
      businessDurationSeconds += trip.durationSeconds;
    }
  }

  const totalExpensesUsd = expenses.reduce((sum, expense) => sum + expense.amountUsd, 0);
  const vehicleCostsUsd = businessMiles * vehicleCostPerMileUsd;
  const netEarningsUsd = grossEarningsUsd - totalExpensesUsd - vehicleCostsUsd;

  const businessHours = businessDurationSeconds / 3600;

  return {
    grossEarningsUsd,
    netEarningsUsd,
    totalExpensesUsd,
    vehicleCostsUsd,
    milesAll,
    businessMiles,
    earningsPerMileUsd: businessMiles > 0 ? grossEarningsUsd / businessMiles : 0,
    netEarningsPerMileUsd: businessMiles > 0 ? netEarningsUsd / businessMiles : 0,
    earningsPerHourUsd: businessHours > 0 ? netEarningsUsd / businessHours : 0,
    avgTripDistanceMiles: tripCount > 0 ? milesAll / tripCount : 0,
    avgTripDurationSeconds: tripCount > 0 ? durationAll / tripCount : 0,
    tripCount,
  };
}

function tripsIn(trips: RawTrip[], range: DateRange): RawTrip[] {
  return trips.filter((trip) => inRange(new Date(trip.endedAt), range));
}

function expensesIn(expenses: RawExpense[], range: DateRange): RawExpense[] {
  return expenses.filter((expense) => inRange(parseLocalDate(expense.incurredOn), range));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

interface Bucket extends DateRange {
  label: string;
}

function dailyBuckets(now: Date, count: number, locale: string): Bucket[] {
  const today = startOfDay(now);
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(today, i - (count - 1));
    return { start, end: addDays(start, 1), label: formatter.format(start) };
  });
}

function weeklyBuckets(now: Date, count: number, locale: string): Bucket[] {
  const todayEnd = addDays(startOfDay(now), 1);
  const formatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  return Array.from({ length: count }, (_, i) => {
    const end = addDays(todayEnd, (i - (count - 1)) * 7);
    const start = addDays(end, -7);
    return { start, end, label: formatter.format(start) };
  });
}

function monthlyBuckets(now: Date, count: number, locale: string): Bucket[] {
  const thisMonthStart = startOfMonth(now);
  const formatter = new Intl.DateTimeFormat(locale, { month: "short" });
  return Array.from({ length: count }, (_, i) => {
    const start = addMonths(thisMonthStart, i - (count - 1));
    return { start, end: addMonths(start, 1), label: formatter.format(start) };
  });
}

const TREND_LENGTH: Record<Granularity, number> = { daily: 14, weekly: 8, monthly: 6 };

function bucketsFor(granularity: Granularity, now: Date, locale: string): Bucket[] {
  const count = TREND_LENGTH[granularity];
  if (granularity === "daily") return dailyBuckets(now, count, locale);
  if (granularity === "weekly") return weeklyBuckets(now, count, locale);
  return monthlyBuckets(now, count, locale);
}

/**
 * Current/previous period boundaries per granularity: today vs. yesterday,
 * this rolling 7 days vs. the 7 before that (same "local day, not the
 * server's" rolling-week convention as the Dashboard), this calendar month
 * vs. the previous one.
 */
function currentAndPreviousRanges(granularity: Granularity, now: Date): { current: DateRange; previous: DateRange } {
  if (granularity === "daily") {
    const today = startOfDay(now);
    return {
      current: { start: today, end: addDays(today, 1) },
      previous: { start: addDays(today, -1), end: today },
    };
  }
  if (granularity === "weekly") {
    const end = addDays(startOfDay(now), 1);
    const start = addDays(end, -7);
    return {
      current: { start, end },
      previous: { start: addDays(start, -7), end: start },
    };
  }
  const thisMonthStart = startOfMonth(now);
  const nextMonthStart = addMonths(thisMonthStart, 1);
  const prevMonthStart = addMonths(thisMonthStart, -1);
  return {
    current: { start: thisMonthStart, end: nextMonthStart },
    previous: { start: prevMonthStart, end: thisMonthStart },
  };
}

export function computeAnalytics(
  trips: RawTrip[],
  expenses: RawExpense[],
  vehicleCostPerMileUsd: number,
  granularity: Granularity,
  now: Date,
  locale: string,
): GranularityData {
  const { current, previous } = currentAndPreviousRanges(granularity, now);

  const currentMetrics = computeMetrics(tripsIn(trips, current), expensesIn(expenses, current), vehicleCostPerMileUsd);
  const previousMetrics = computeMetrics(tripsIn(trips, previous), expensesIn(expenses, previous), vehicleCostPerMileUsd);

  const trend = bucketsFor(granularity, now, locale).map((bucket) => {
    const metrics = computeMetrics(tripsIn(trips, bucket), expensesIn(expenses, bucket), vehicleCostPerMileUsd);
    return {
      label: bucket.label,
      netEarningsUsd: metrics.netEarningsUsd,
      netEarningsPerMileUsd: metrics.netEarningsPerMileUsd,
    };
  });

  return { current: currentMetrics, previous: previousMetrics, trend };
}

export type PeriodComparison =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "percent"; value: number };

/**
 * `previous === 0` can't produce a meaningful percentage (division by
 * zero) — "new" flags activity that simply didn't exist last period,
 * distinct from "none" (nothing changed because both periods are zero).
 */
export function comparePeriods(current: number, previous: number): PeriodComparison {
  if (previous === 0) {
    return current === 0 ? { kind: "none" } : { kind: "new" };
  }
  return { kind: "percent", value: ((current - previous) / Math.abs(previous)) * 100 };
}
