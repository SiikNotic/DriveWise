"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2Icon } from "lucide-react";

import { deleteVehicleAction } from "@/lib/vehicles/actions";
import { initialVehicleActionState } from "@/lib/vehicles/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";

export function DeleteVehicleDialog({ vehicleId }: { vehicleId: string }) {
  const t = useTranslations("vehicles.deleteConfirm");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(deleteVehicleAction, initialVehicleActionState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trash2Icon />
          {tc("delete")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <FormError message={state?.error} />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{tc("cancel")}</Button>
          </DialogClose>
          <form action={formAction}>
            <input type="hidden" name="id" value={vehicleId} />
            <SubmitButton
              pendingChildren={tc("delete")}
              variant="destructive"
              className="w-full"
            >
              {tc("delete")}
            </SubmitButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
