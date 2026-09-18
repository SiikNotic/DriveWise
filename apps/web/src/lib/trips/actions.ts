"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { isTripPurpose } from "@drivewise/shared";

import { createClient } from "@/lib/supabase/server";
import type { TripActionState } from "./types";

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Only ever called for a trip that has already synced to Supabase — see trip-source.ts, which dispatches a still-local trip's edit straight to IndexedDB instead. */
export async function updateTripPurposeAction(
  _prevState: TripActionState,
  formData: FormData,
): Promise<TripActionState> {
  const te = await getTranslations("errors");
  const id = str(formData, "id");
  const purpose = str(formData, "purpose");

  if (!id || !isTripPurpose(purpose)) {
    return { error: te("generic") };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) {
    return { error: te("unauthorized") };
  }

  const { error } = await supabase
    .from("trips")
    .update({ purpose })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/trips");
  return { success: true };
}

/** Only ever called for a trip that has already synced — see updateTripPurposeAction's note. */
export async function deleteTripAction(
  _prevState: TripActionState,
  formData: FormData,
): Promise<TripActionState> {
  const te = await getTranslations("errors");
  const id = str(formData, "id");

  if (!id) {
    return { error: te("notFound") };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) {
    return { error: te("unauthorized") };
  }

  const { error, data } = await supabase
    .from("trips")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { error: error?.message ?? te("notFound") };
  }

  revalidatePath("/trips");
  return { success: true };
}
