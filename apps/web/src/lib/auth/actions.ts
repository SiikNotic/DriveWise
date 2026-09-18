"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/get-origin";
import type { ActionState } from "./types";

const MIN_PASSWORD_LENGTH = 8;

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email);
}

export async function signUpAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const t = await getTranslations("validation");
  const locale = await getLocale();

  const firstName = str(formData, "firstName");
  const lastName = str(formData, "lastName");
  const email = str(formData, "email");
  const phone = str(formData, "phone");
  const country = str(formData, "country");
  const state = str(formData, "state");
  const password = str(formData, "password");
  const confirmPassword = str(formData, "confirmPassword");

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return { error: t("required") };
  }
  if (!isValidEmail(email)) {
    return { error: t("invalidEmail") };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: t("passwordTooShort", { min: MIN_PASSWORD_LENGTH }) };
  }
  if (password !== confirmPassword) {
    return { error: t("passwordsDontMatch") };
  }

  const origin = await getOrigin();
  const supabase = await createClient();

  // Additional profile fields ride in `options.data` (raw_user_meta_data),
  // read by the handle_new_user trigger to seed public.profiles. Never used
  // for authorization — see the migration's comment on why that's safe.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/${locale}`,
      data: {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        country: country || null,
        state: state || null,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is off for this project, signUp returns a live
  // session immediately; otherwise data.session is null until confirmed.
  if (data.session) {
    redirect({ href: "/", locale });
  }

  return { success: true, checkEmail: true, email };
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const t = await getTranslations("validation");
  const locale = await getLocale();

  const email = str(formData, "email");
  const password = str(formData, "password");

  if (!email || !password) {
    return { error: t("required") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect({ href: "/", locale });
  // Unreachable — redirect() always throws — but keeps the return type
  // honest without widening ActionState to include undefined.
  return {};
}

export async function requestPasswordResetAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const t = await getTranslations("validation");
  const locale = await getLocale();
  const email = str(formData, "email");

  if (!email) {
    return { error: t("required") };
  }
  if (!isValidEmail(email)) {
    return { error: t("invalidEmail") };
  }

  const origin = await getOrigin();
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/${locale}/reset-password`,
  });

  // Never reveal whether the address has an account — always report
  // success (standard anti-enumeration practice for password resets).
  if (error) {
    console.error("resetPasswordForEmail failed:", error.message);
  }

  return { success: true, checkEmail: true, email };
}

export async function updatePasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const t = await getTranslations("validation");
  const locale = await getLocale();

  const password = str(formData, "password");
  const confirmPassword = str(formData, "confirmPassword");

  if (!password || !confirmPassword) {
    return { error: t("required") };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: t("passwordTooShort", { min: MIN_PASSWORD_LENGTH }) };
  }
  if (password !== confirmPassword) {
    return { error: t("passwordsDontMatch") };
  }

  // This only succeeds because /auth/confirm already exchanged the
  // recovery link's token_hash for a (recovery-scoped) session — see that
  // route handler. Without it there is no session to update.
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  redirect({ href: "/", locale });
  return {};
}

export async function updateProfileAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const t = await getTranslations("validation");
  const te = await getTranslations("errors");

  const firstName = str(formData, "firstName");
  const lastName = str(formData, "lastName");
  const phone = str(formData, "phone");
  const country = str(formData, "country");
  const state = str(formData, "state");

  if (!firstName || !lastName) {
    return { error: t("required") };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (!userId) {
    return { error: te("unauthorized") };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      country: country || null,
      state: state || null,
    })
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
