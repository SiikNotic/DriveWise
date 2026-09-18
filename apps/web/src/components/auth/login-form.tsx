"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { loginAction } from "@/lib/auth/actions";
import { initialActionState } from "@/lib/auth/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError } from "@/components/auth/form-error";
import { Link } from "@/i18n/navigation";

export function LoginForm({ prefillError }: { prefillError?: string }) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState(loginAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error ?? prefillError} />

      <div className="grid gap-1.5">
        <Label htmlFor="email">{t("fields.email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("fields.password")}</Label>
          <Link
            href="/forgot-password"
            className="text-muted-foreground text-xs hover:underline"
          >
            {t("signIn.forgotPassword")}
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <SubmitButton pendingChildren={t("signIn.submitting")}>
        {t("signIn.submit")}
      </SubmitButton>

      <p className="text-muted-foreground text-center text-sm">
        {t("signIn.noAccount")}{" "}
        <Link href="/sign-up" className="text-foreground font-medium hover:underline">
          {t("signIn.createAccount")}
        </Link>
      </p>
    </form>
  );
}
