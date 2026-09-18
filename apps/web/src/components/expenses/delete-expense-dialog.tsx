"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Trash2Icon } from "lucide-react";

import { deleteExpenseAction } from "@/lib/expenses/actions";
import { initialExpenseActionState } from "@/lib/expenses/types";
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

export function DeleteExpenseDialog({ expenseId }: { expenseId: string }) {
  const t = useTranslations("expenses.deleteConfirm");
  const tc = useTranslations("common");
  const [state, formAction] = useActionState(deleteExpenseAction, initialExpenseActionState);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
          <Trash2Icon />
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
            <input type="hidden" name="id" value={expenseId} />
            <SubmitButton pendingChildren={tc("delete")} variant="destructive" className="w-full">
              {tc("delete")}
            </SubmitButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
