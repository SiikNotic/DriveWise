"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2Icon } from "lucide-react";

import { deleteExpenseRecord, type ExpenseListRow } from "@/lib/expenses/expense-source";
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
import { FormError } from "@/components/forms/form-error";

/** Dispatches to a Server Action (synced) or straight to IndexedDB (still local) — see expense-source.ts's deleteExpenseRecord. */
export function DeleteExpenseDialog({ row, onDeleted }: { row: ExpenseListRow; onDeleted: () => void }) {
  const t = useTranslations("expenses.deleteConfirm");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteExpenseRecord(row);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    onDeleted();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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

        <FormError message={error} />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{tc("cancel")}</Button>
          </DialogClose>
          <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
            {tc("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
