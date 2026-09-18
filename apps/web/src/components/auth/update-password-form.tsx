"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { updatePasswordAction } from "@/lib/auth/actions";
import { initialActionState } from "@/lib/auth/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError } from "@/components/auth/form-error";

export function UpdatePasswordForm() {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState(updatePasswordAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />

      <div className="grid gap-1.5">
        <Label htmlFor="password">{t("fields.newPassword")}</Label>
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

      <SubmitButton pendingChildren={t("updatePassword.submitting")}>
        {t("updatePassword.submit")}
      </SubmitButton>
    </form>
  );
}
