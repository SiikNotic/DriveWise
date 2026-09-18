"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { isExpenseCategory } from "@drivewise/shared";

import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedReceiptType, MAX_RECEIPT_BYTES, type ExpenseActionState } from "./types";

const RECEIPTS_BUCKET = "receipts";

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

interface ParsedExpenseForm {
  amountUsd: number | null;
  incurredOn: string;
  category: string;
  vehicleId: string | null;
  description: string | null;
  removeReceipt: boolean;
}

function parseExpenseForm(formData: FormData): ParsedExpenseForm {
  return {
    amountUsd: num(formData, "amountUsd"),
    incurredOn: str(formData, "incurredOn"),
    category: str(formData, "category"),
    vehicleId: str(formData, "vehicleId") || null,
    description: str(formData, "description") || null,
    removeReceipt: str(formData, "removeReceipt") === "true",
  };
}

async function validateExpenseForm(parsed: ParsedExpenseForm): Promise<string | null> {
  const t = await getTranslations("validation");

  if (parsed.amountUsd === null || parsed.amountUsd < 0) {
    return t("invalidNumber");
  }
  if (!parsed.incurredOn) {
    return t("required");
  }
  if (!isExpenseCategory(parsed.category)) {
    return t("required");
  }
  return null;
}

/** File extension only, stripped of anything that could escape the `<user_id>/` prefix the receipts bucket's RLS policies key on. */
function safeExtension(filename: string): string {
  const match = /\.([a-zA-Z0-9]{1,8})$/.exec(filename);
  return match ? match[1]!.toLowerCase() : "jpg";
}

async function uploadReceipt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  file: File,
): Promise<{ path?: string; error?: string }> {
  if (file.size === 0) return {};
  if (file.size > MAX_RECEIPT_BYTES) {
    const t = await getTranslations("validation");
    return { error: t("invalidNumber") };
  }
  if (!isAllowedReceiptType(file.type)) {
    const t = await getTranslations("validation");
    return { error: t("invalidFileType") };
  }

  const path = `${userId}/${randomUUID()}.${safeExtension(file.name)}`;
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });

  if (error) {
    return { error: error.message };
  }
  return { path };
}

async function deleteReceipt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
): Promise<void> {
  if (!path) return;
  await supabase.storage.from(RECEIPTS_BUCKET).remove([path]);
}

export async function createExpenseAction(
  _prevState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const te = await getTranslations("errors");
  const locale = await getLocale();
  const parsed = parseExpenseForm(formData);

  const validationError = await validateExpenseForm(parsed);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) {
    return { error: te("unauthorized") };
  }

  let receiptStoragePath: string | null = null;
  const receiptFile = formData.get("receipt");
  if (receiptFile instanceof File && receiptFile.size > 0) {
    const result = await uploadReceipt(supabase, userId, receiptFile);
    if (result.error) {
      return { error: result.error };
    }
    receiptStoragePath = result.path ?? null;
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
      client_id: randomUUID(),
      vehicle_id: parsed.vehicleId,
      // Validated by isExpenseCategory above.
      category: parsed.category as "fuel",
      amount_usd: parsed.amountUsd!,
      incurred_on: parsed.incurredOn,
      description: parsed.description,
      receipt_storage_path: receiptStoragePath,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (receiptStoragePath) await deleteReceipt(supabase, receiptStoragePath);
    return { error: error?.message ?? te("generic") };
  }

  revalidatePath("/expenses");
  redirect({ href: "/expenses", locale });
  return {};
}

export async function updateExpenseAction(
  _prevState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const te = await getTranslations("errors");
  const locale = await getLocale();
  const id = str(formData, "id");
  const parsed = parseExpenseForm(formData);

  if (!id) {
    return { error: te("notFound") };
  }

  const validationError = await validateExpenseForm(parsed);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) {
    return { error: te("unauthorized") };
  }

  const { data: existing } = await supabase
    .from("expenses")
    .select("receipt_storage_path")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    return { error: te("notFound") };
  }

  let receiptStoragePath = existing.receipt_storage_path;
  const receiptFile = formData.get("receipt");

  if (receiptFile instanceof File && receiptFile.size > 0) {
    const result = await uploadReceipt(supabase, userId, receiptFile);
    if (result.error) {
      return { error: result.error };
    }
    await deleteReceipt(supabase, existing.receipt_storage_path);
    receiptStoragePath = result.path ?? null;
  } else if (parsed.removeReceipt) {
    await deleteReceipt(supabase, existing.receipt_storage_path);
    receiptStoragePath = null;
  }

  const { error } = await supabase
    .from("expenses")
    .update({
      vehicle_id: parsed.vehicleId,
      category: parsed.category as "fuel",
      amount_usd: parsed.amountUsd!,
      incurred_on: parsed.incurredOn,
      description: parsed.description,
      receipt_storage_path: receiptStoragePath,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/expenses");
  redirect({ href: "/expenses", locale });
  return {};
}

export async function deleteExpenseAction(
  _prevState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
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

  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("receipt_storage_path")
    .maybeSingle();

  if (error || !data) {
    return { error: error?.message ?? te("notFound") };
  }

  await deleteReceipt(supabase, data.receipt_storage_path);

  revalidatePath("/expenses");
  return { success: true };
}

export async function getReceiptSignedUrlAction(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  // Defense in depth: the path's own leading `<user_id>/` segment is what
  // Storage RLS actually enforces, but checking it here too means a
  // mismatched call never even reaches Storage.
  if (!userId || !path.startsWith(`${userId}/`)) return null;

  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(path, 60 * 5);
  if (error || !data) return null;
  return data.signedUrl;
}
