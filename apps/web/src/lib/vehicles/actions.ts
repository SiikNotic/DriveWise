"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isFuelType,
  MAX_VEHICLE_YEAR,
  MIN_VEHICLE_YEAR,
  type VehicleActionState,
} from "./types";

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

interface ParsedVehicleForm {
  nickname: string;
  make: string;
  model: string;
  trim: string | null;
  fuelType: string;
  year: number | null;
  fuelEfficiencyMpg: number | null;
  fuelPriceUsd: number;
  insuranceMonthlyCostUsd: number;
  maintenanceCostPerMileUsd: number;
  depreciationCostPerMileUsd: number;
  otherOperatingCostPerMileUsd: number;
  estimatedMonthlyMiles: number;
}

function parseVehicleForm(formData: FormData): ParsedVehicleForm {
  return {
    nickname: str(formData, "nickname"),
    make: str(formData, "make"),
    model: str(formData, "model"),
    trim: str(formData, "trim") || null,
    fuelType: str(formData, "fuelType"),
    year: num(formData, "year"),
    fuelEfficiencyMpg: num(formData, "fuelEfficiencyMpg"),
    fuelPriceUsd: num(formData, "fuelPriceUsd") ?? 0,
    insuranceMonthlyCostUsd: num(formData, "insuranceMonthlyCostUsd") ?? 0,
    maintenanceCostPerMileUsd: num(formData, "maintenanceCostPerMileUsd") ?? 0,
    depreciationCostPerMileUsd: num(formData, "depreciationCostPerMileUsd") ?? 0,
    otherOperatingCostPerMileUsd: num(formData, "otherOperatingCostPerMileUsd") ?? 0,
    estimatedMonthlyMiles: num(formData, "estimatedMonthlyMiles") ?? 1000,
  };
}

/** Shared by create/update — both parse the same fields and enforce the same rules. */
async function validateVehicleForm(
  parsed: ParsedVehicleForm,
): Promise<string | null> {
  const t = await getTranslations("validation");

  if (!parsed.nickname || !parsed.make || !parsed.model) {
    return t("required");
  }
  if (!isFuelType(parsed.fuelType)) {
    return t("required");
  }
  if (parsed.year === null) {
    return t("required");
  }
  if (parsed.year < MIN_VEHICLE_YEAR) {
    return t("minValue", { min: MIN_VEHICLE_YEAR });
  }
  if (parsed.year > MAX_VEHICLE_YEAR) {
    return t("maxValue", { max: MAX_VEHICLE_YEAR });
  }
  if (parsed.fuelEfficiencyMpg === null || parsed.fuelEfficiencyMpg <= 0) {
    return t("invalidNumber");
  }
  const nonNegativeFields = [
    parsed.fuelPriceUsd,
    parsed.insuranceMonthlyCostUsd,
    parsed.maintenanceCostPerMileUsd,
    parsed.depreciationCostPerMileUsd,
    parsed.otherOperatingCostPerMileUsd,
  ];
  if (nonNegativeFields.some((value) => value < 0) || parsed.estimatedMonthlyMiles <= 0) {
    return t("invalidNumber");
  }

  return null;
}

export async function createVehicleAction(
  _prevState: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  const te = await getTranslations("errors");
  const locale = await getLocale();
  const parsed = parseVehicleForm(formData);

  const validationError = await validateVehicleForm(parsed);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) {
    return { error: te("unauthorized") };
  }

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      user_id: userId,
      client_id: randomUUID(),
      nickname: parsed.nickname,
      make: parsed.make,
      model: parsed.model,
      trim: parsed.trim,
      year: parsed.year!,
      // Validated by isFuelType above.
      fuel_type: parsed.fuelType as "gasoline" | "diesel" | "hybrid" | "electric",
      fuel_efficiency_mpg: parsed.fuelEfficiencyMpg!,
      fuel_price_usd: parsed.fuelPriceUsd,
      insurance_monthly_cost_usd: parsed.insuranceMonthlyCostUsd,
      maintenance_cost_per_mile_usd: parsed.maintenanceCostPerMileUsd,
      depreciation_cost_per_mile_usd: parsed.depreciationCostPerMileUsd,
      other_operating_cost_per_mile_usd: parsed.otherOperatingCostPerMileUsd,
      estimated_monthly_miles: parsed.estimatedMonthlyMiles,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? te("generic") };
  }

  revalidatePath("/vehicles");
  redirect({ href: `/vehicles/${data.id}`, locale });
  // Unreachable — redirect() always throws — but keeps the return type
  // honest without widening VehicleActionState to include undefined.
  return {};
}

export async function updateVehicleAction(
  _prevState: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  const te = await getTranslations("errors");
  const locale = await getLocale();
  const id = str(formData, "id");
  const parsed = parseVehicleForm(formData);

  if (!id) {
    return { error: te("notFound") };
  }

  const validationError = await validateVehicleForm(parsed);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) {
    return { error: te("unauthorized") };
  }

  const { data, error } = await supabase
    .from("vehicles")
    .update({
      nickname: parsed.nickname,
      make: parsed.make,
      model: parsed.model,
      trim: parsed.trim,
      year: parsed.year!,
      fuel_type: parsed.fuelType as "gasoline" | "diesel" | "hybrid" | "electric",
      fuel_efficiency_mpg: parsed.fuelEfficiencyMpg!,
      fuel_price_usd: parsed.fuelPriceUsd,
      insurance_monthly_cost_usd: parsed.insuranceMonthlyCostUsd,
      maintenance_cost_per_mile_usd: parsed.maintenanceCostPerMileUsd,
      depreciation_cost_per_mile_usd: parsed.depreciationCostPerMileUsd,
      other_operating_cost_per_mile_usd: parsed.otherOperatingCostPerMileUsd,
      estimated_monthly_miles: parsed.estimatedMonthlyMiles,
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? te("notFound") };
  }

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
  redirect({ href: `/vehicles/${id}`, locale });
  return {};
}

export async function deleteVehicleAction(
  _prevState: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  const te = await getTranslations("errors");
  const locale = await getLocale();
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

  const { data, error } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? te("notFound") };
  }

  // The vehicle's own row is gone; if it was the active one,
  // user_settings.default_vehicle_id already went to null via its
  // `on delete set null` foreign key — nothing more to clean up here.
  revalidatePath("/vehicles");
  revalidatePath("/", "layout");
  redirect({ href: "/vehicles", locale });
  return {};
}

export async function setActiveVehicleAction(
  _prevState: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
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

  // Confirm the vehicle is actually this user's before pointing
  // user_settings at it — otherwise a crafted id would pass RLS (you can
  // always update your own settings row) while silently pointing it at a
  // vehicle you don't own.
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!vehicle) {
    return { error: te("notFound") };
  }

  const { error } = await supabase
    .from("user_settings")
    .update({ default_vehicle_id: id })
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/vehicles");
  revalidatePath("/", "layout");
  return { success: true };
}
