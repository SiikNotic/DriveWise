"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { StarIcon } from "lucide-react";

import { setActiveVehicleAction } from "@/lib/vehicles/actions";
import { initialVehicleActionState } from "@/lib/vehicles/types";
import { SubmitButton } from "@/components/forms/submit-button";

export function SetActiveVehicleButton({ vehicleId }: { vehicleId: string }) {
  const t = useTranslations("vehicles");
  const tn = useTranslations("notifications");
  const [state, formAction] = useActionState(
    setActiveVehicleAction,
    initialVehicleActionState,
  );

  useEffect(() => {
    if (state?.success) {
      toast(tn("vehicleSaved"));
    } else if (state?.error) {
      toast(state.error);
    }
  }, [state, tn]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={vehicleId} />
      <SubmitButton pendingChildren={t("setActive")} variant="outline">
        <StarIcon />
        {t("setActive")}
      </SubmitButton>
    </form>
  );
}
