"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { COUNTRIES, US_STATES } from "@drivewise/shared";

import { signUpAction } from "@/lib/auth/actions";
import { initialActionState } from "@/lib/auth/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";
import { Link } from "@/i18n/navigation";

export function SignUpForm() {
  const t = useTranslations("auth");
  const tSettings = useTranslations("settings.profile");
  const [state, formAction] = useActionState(signUpAction, initialActionState);

  if (state?.checkEmail) {
    return (
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-lg font-semibold">{t("signUp.checkEmailTitle")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("signUp.checkEmailDescription", { email: state.email ?? "" })}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="firstName">{t("fields.firstName")}</Label>
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lastName">{t("fields.lastName")}</Label>
          <Input id="lastName" name="lastName" autoComplete="family-name" required />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="email">{t("fields.email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="phone">{t("fields.phone")}</Label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="country">{t("fields.country")}</Label>
          <NativeSelect id="country" name="country" defaultValue="">
            <option value="" disabled>
              {tSettings("countryPlaceholder")}
            </option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {tSettings(`countries.${c.code}` as "countries.US" | "countries.OTHER")}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="state">{t("fields.state")}</Label>
          <NativeSelect id="state" name="state" defaultValue="">
            <option value="" disabled>
              {tSettings("statePlaceholder")}
            </option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="password">{t("fields.password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="confirmPassword">{t("fields.confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <SubmitButton pendingChildren={t("signUp.submitting")}>
        {t("signUp.submit")}
      </SubmitButton>

      <p className="text-muted-foreground text-center text-sm">
        {t("signUp.haveAccount")}{" "}
        <Link href="/login" className="text-foreground font-medium hover:underline">
          {t("signUp.signIn")}
        </Link>
      </p>
    </form>
  );
}
