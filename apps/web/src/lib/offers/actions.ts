"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import type { OfferActionState } from "./types";

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Updates the two Offer Analyzer thresholds — editable from Settings or inline on the Offer Analyzer itself. */
export async function updateOfferThresholdsAction(
  _prevState: OfferActionState,
  formData: FormData,
): Promise<OfferActionState> {
  const t = await getTranslations("validation");
  const te = await getTranslations("errors");

  const minHourlyEarningsUsd = num(formData, "minHourlyEarningsUsd");
  const minPerMileEarningsUsd = num(formData, "minPerMileEarningsUsd");

  if (
    minHourlyEarningsUsd === null ||
    minPerMileEarningsUsd === null ||
    minHourlyEarningsUsd < 0 ||
    minPerMileEarningsUsd < 0
  ) {
    return { error: t("invalidNumber") };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) {
    return { error: te("unauthorized") };
  }

  const { error } = await supabase
    .from("user_settings")
    .update({
      min_hourly_earnings_usd: minHourlyEarningsUsd,
      min_per_mile_earnings_usd: minPerMileEarningsUsd,
    })
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/offers");
  revalidatePath("/settings");
  return { success: true };
}

/**
 * Optionally records the driver's decision on an already-analyzed offer.
 * Deliberately does not open onto any list/history view — see README's
 * scope note for the Offer Analyzer.
 */
export async function saveOfferDecisionAction(
  _prevState: OfferActionState,
  formData: FormData,
): Promise<OfferActionState> {
  const te = await getTranslations("errors");

  const offeredPayUsd = num(formData, "offeredPayUsd");
  const estimatedDistanceMiles = num(formData, "estimatedDistanceMiles");
  const estimatedDurationMinutes = num(formData, "estimatedDurationMinutes");
  const estimatedReturnDistanceMiles = num(formData, "estimatedReturnDistanceMiles");
  const additionalWaitMinutes = num(formData, "additionalWaitMinutes");
  const vehicleId = str(formData, "vehicleId") || null;
  const decision = str(formData, "decision");

  if (
    offeredPayUsd === null ||
    estimatedDistanceMiles === null ||
    estimatedDurationMinutes === null ||
    (decision !== "accepted" && decision !== "declined")
  ) {
    return { error: te("generic") };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) {
    return { error: te("unauthorized") };
  }

  const { error } = await supabase.from("delivery_offers").insert({
    user_id: userId,
    client_id: randomUUID(),
    vehicle_id: vehicleId,
    platform: "other",
    offered_pay_usd: offeredPayUsd,
    estimated_distance_miles: estimatedDistanceMiles,
    estimated_duration_minutes: estimatedDurationMinutes + (additionalWaitMinutes ?? 0),
    estimated_return_distance_miles: estimatedReturnDistanceMiles,
    linked_trip_id: null,
    decision,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
