"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { updateOfferThresholdsAction } from "@/lib/offers/actions";
import { initialOfferActionState } from "@/lib/offers/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";

/**
 * The Offer Analyzer's two driver-configurable targets. Rendered both as its
 * own Settings card and, in `compact` form, inline on the Offer Analyzer
 * page itself — the driver should never have to leave the analyzer to
 * adjust what "worth it" means to them.
 */
export function ThresholdsForm({
  minHourlyEarningsUsd,
  minPerMileEarningsUsd,
  compact = false,
}: {
  minHourlyEarningsUsd: number;
  minPerMileEarningsUsd: number;
  compact?: boolean;
}) {
  const t = useTranslations("offers.targets");
  const tn = useTranslations("notifications");
  const [state, formAction] = useActionState(
    updateOfferThresholdsAction,
    initialOfferActionState,
  );

  useEffect(() => {
    if (state?.success) {
      toast(tn("settingsSaved"));
    }
  }, [state?.success, tn]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="minHourlyEarningsUsd">{t("minHourly")}</Label>
          <Input
            id="minHourlyEarningsUsd"
            name="minHourlyEarningsUsd"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            defaultValue={minHourlyEarningsUsd}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="minPerMileEarningsUsd">{t("minPerMile")}</Label>
          <Input
            id="minPerMileEarningsUsd"
            name="minPerMileEarningsUsd"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            defaultValue={minPerMileEarningsUsd}
          />
        </div>
      </div>
      <div>
        <SubmitButton pendingChildren={t("save")} variant={compact ? "outline" : "default"}>
          {t("save")}
        </SubmitButton>
      </div>
    </form>
  );
}
