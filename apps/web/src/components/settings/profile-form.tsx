"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { COUNTRIES, US_STATES } from "@drivewise/shared";

import { updateProfileAction } from "@/lib/auth/actions";
import { initialActionState } from "@/lib/auth/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError } from "@/components/auth/form-error";

export interface ProfileFormValues {
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  state: string;
}

export function ProfileForm({
  email,
  defaultValues,
}: {
  email: string;
  defaultValues: ProfileFormValues;
}) {
  const t = useTranslations("auth.fields");
  const tp = useTranslations("settings.profile");
  const tn = useTranslations("notifications");
  const [state, formAction] = useActionState(updateProfileAction, initialActionState);

  useEffect(() => {
    if (state?.success) {
      toast(tn("settingsSaved"));
    }
  }, [state?.success, tn]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />

      <div className="grid gap-1.5">
        <Label htmlFor="profile-email">{tp("email")}</Label>
        <Input id="profile-email" value={email} disabled />
        <p className="text-muted-foreground text-xs">{tp("emailNote")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="firstName">{t("firstName")}</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={defaultValues.firstName}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lastName">{t("lastName")}</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={defaultValues.lastName}
            required
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="phone">{t("phone")}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={defaultValues.phone}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="country">{t("country")}</Label>
          <NativeSelect id="country" name="country" defaultValue={defaultValues.country}>
            <option value="">{tp("countryPlaceholder")}</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {tp(`countries.${c.code}` as "countries.US" | "countries.OTHER")}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="state">{t("state")}</Label>
          <NativeSelect id="state" name="state" defaultValue={defaultValues.state}>
            <option value="">{tp("statePlaceholder")}</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div>
        <SubmitButton pendingChildren={tp("saving")}>{tp("save")}</SubmitButton>
      </div>
    </form>
  );
}
