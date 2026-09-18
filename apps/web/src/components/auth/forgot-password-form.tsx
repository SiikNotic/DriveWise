"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { requestPasswordResetAction } from "@/lib/auth/actions";
import { initialActionState } from "@/lib/auth/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError } from "@/components/auth/form-error";
import { Link } from "@/i18n/navigation";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState(
    requestPasswordResetAction,
    initialActionState,
  );

  if (state?.checkEmail) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div>
          <h2 className="text-lg font-semibold">
            {t("resetPassword.checkEmailTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("resetPassword.checkEmailDescription", { email: state.email ?? "" })}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/login">{t("resetPassword.backToSignIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />

      <div className="grid gap-1.5">
        <Label htmlFor="email">{t("fields.email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <SubmitButton pendingChildren={t("resetPassword.submitting")}>
        {t("resetPassword.submit")}
      </SubmitButton>

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="hover:underline">
          {t("resetPassword.backToSignIn")}
        </Link>
      </p>
    </form>
  );
}
