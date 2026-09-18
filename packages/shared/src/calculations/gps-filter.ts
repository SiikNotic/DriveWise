import type { RawGpsSample } from "../types/gps";
import { haversineDistanceMiles } from "./distance";

const METERS_PER_MILE = 1609.344;

/**
 * Tuning for the two independent jobs this file does:
 *  1. Is this fix trustworthy at all? (accuracy + plausibility filter)
 *  2. Is this trustworthy fix worth writing to storage? (capture decision)
 *
 * These numbers are the practical defaults mileage-tracking apps converge
 * on; they're exposed as overridable config, not hardcoded, since a mobile
 * client with a native provider may want to tune them differently.
 */
export const GPS_FILTER_DEFAULTS = {
  /** Reject fixes whose reported uncertainty radius is worse than this. */
  maxAcceptableAccuracyMeters: 50,
  /** ~134 mph. Real delivery driving never approaches this; a jump past it is a GPS artifact (multipath, urban canyon, cold-fix teleport), not a real position change. */
  maxPlausibleSpeedMetersPerSecond: 60,
  /** Don't treat two fixes closer together than this as a reliable speed sample (avoids divide-by-near-zero noise). */
  minPlausibilityIntervalSeconds: 1,
  /** Write a point once the vehicle has moved at least this far from the last written point. */
  minCaptureDistanceMeters: 20,
  /** Otherwise write a heartbeat point at least this often, so idle time (a red light, a stop) still contributes to duration/route data. */
  maxCaptureIntervalMs: 30_000,
  /** Capture on a sharp turn even if the distance threshold isn't met yet, so the route shape isn't lost between sparse points. */
  minBearingChangeDegrees: 30,
  /** After this many consecutive heartbeat-only captures with no real movement, stop writing points until the vehicle actually moves again — a long stop (waiting for a pickup) shouldn't keep accumulating points forever. */
  maxConsecutiveStationaryHeartbeats: 3,
} as const;

export type GpsFilterConfig = typeof GPS_FILTER_DEFAULTS;

function withDefaults(config?: Partial<GpsFilterConfig>): GpsFilterConfig {
  return { ...GPS_FILTER_DEFAULTS, ...config };
}

/** Job 1a: is the fix itself precise enough to trust? */
export function isAccuracyAcceptable(
  sample: RawGpsSample,
  config?: Partial<GpsFilterConfig>,
): boolean {
  const { maxAcceptableAccuracyMeters } = withDefaults(config);
  // Some providers don't report accuracy at all; treat "unknown" as
  // passable rather than silently discarding every fix from that provider.
  return sample.accuracyMeters === null || sample.accuracyMeters <= maxAcceptableAccuracyMeters;
}

/**
 * Job 1b: is the implied speed from the last accepted fix to this one
 * physically plausible? Catches GPS teleports (a fix hundreds of meters
 * away a second later) and out-of-order/duplicate timestamps.
 */
export function isPlausibleMovement(
  previous: RawGpsSample,
  candidate: RawGpsSample,
  config?: Partial<GpsFilterConfig>,
): boolean {
  const { maxPlausibleSpeedMetersPerSecond, minPlausibilityIntervalSeconds } =
    withDefaults(config);

  const dtSeconds =
    (new Date(candidate.timestamp).getTime() - new Date(previous.timestamp).getTime()) / 1000;

  // Non-monotonic or duplicate-timestamp fixes are never plausible on their own terms.
  if (dtSeconds <= 0) return false;
  // Too close in time to compute a meaningful speed — don't reject on this basis alone.
  if (dtSeconds < minPlausibilityIntervalSeconds) return true;

  const distanceMeters = haversineDistanceMiles(previous, candidate) * METERS_PER_MILE;
  const impliedSpeedMetersPerSecond = distanceMeters / dtSeconds;

  return impliedSpeedMetersPerSecond <= maxPlausibleSpeedMetersPerSecond;
}

/** Combines both trust checks. `previous` is the last *accepted* sample, or null for the first fix of a trip. */
export function isSampleTrustworthy(
  candidate: RawGpsSample,
  previous: RawGpsSample | null,
  config?: Partial<GpsFilterConfig>,
): boolean {
  if (!isAccuracyAcceptable(candidate, config)) return false;
  if (previous && !isPlausibleMovement(previous, candidate, config)) return false;
  return true;
}

/** Initial bearing from a to b, in degrees [0, 360). */
export function bearingDegrees(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;

  return (bearing + 360) % 360;
}

function smallestAngleDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export type CaptureReason =
  | "first_point"
  | "distance_threshold"
  | "time_heartbeat"
  | "bearing_change"
  | "suppressed_stationary"
  | "too_soon";

export interface CaptureDecision {
  shouldCapture: boolean;
  reason: CaptureReason;
}

/**
 * Job 2: given a trustworthy fix, is it worth writing to storage? This is
 * the actual battery/storage/point-count control — every trustworthy fix
 * still reaches here, but only a fraction get persisted. See each default's
 * comment above for the reasoning.
 */
export function decideCapture(input: {
  candidate: RawGpsSample;
  lastCaptured: RawGpsSample | null;
  lastCapturedAtMs: number | null;
  consecutiveStationaryHeartbeats: number;
  nowMs: number;
  config?: Partial<GpsFilterConfig>;
}): CaptureDecision {
  const { candidate, lastCaptured, lastCapturedAtMs, consecutiveStationaryHeartbeats, nowMs } =
    input;
  const config = withDefaults(input.config);

  if (!lastCaptured || lastCapturedAtMs === null) {
    return { shouldCapture: true, reason: "first_point" };
  }

  const distanceMeters = haversineDistanceMiles(lastCaptured, candidate) * METERS_PER_MILE;
  if (distanceMeters >= config.minCaptureDistanceMeters) {
    return { shouldCapture: true, reason: "distance_threshold" };
  }

  const hasBearing =
    lastCaptured.headingDegrees !== undefined && lastCaptured.headingDegrees !== null;
  if (hasBearing && distanceMeters > 0) {
    const newBearing = bearingDegrees(lastCaptured, candidate);
    const change = smallestAngleDifference(lastCaptured.headingDegrees ?? 0, newBearing);
    if (change >= config.minBearingChangeDegrees) {
      return { shouldCapture: true, reason: "bearing_change" };
    }
  }

  const elapsedMs = nowMs - lastCapturedAtMs;
  if (elapsedMs < config.maxCaptureIntervalMs) {
    return { shouldCapture: false, reason: "too_soon" };
  }

  if (consecutiveStationaryHeartbeats >= config.maxConsecutiveStationaryHeartbeats) {
    return { shouldCapture: false, reason: "suppressed_stationary" };
  }

  return { shouldCapture: true, reason: "time_heartbeat" };
}
