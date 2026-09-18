"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { createExpenseAction, updateExpenseAction } from "@/lib/expenses/actions";
import { EXPENSE_CATEGORIES, initialExpenseActionState } from "@/lib/expenses/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";
import { ReceiptThumbnail } from "@/components/expenses/receipt-thumbnail";

export interface ExpenseFormValues {
  amountUsd: string;
  incurredOn: string;
  category: string;
  vehicleId: string;
  description: string;
}

const DEFAULT_VALUES: ExpenseFormValues = {
  amountUsd: "",
  incurredOn: new Date().toISOString().slice(0, 10),
  category: "fuel",
  vehicleId: "",
  description: "",
};

export function ExpenseForm({
  mode,
  expenseId,
  vehicles,
  defaultValues,
  existingReceiptPath,
}: {
  mode: "create" | "edit";
  expenseId?: string;
  vehicles: { id: string; nickname: string }[];
  defaultValues?: Partial<ExpenseFormValues>;
  existingReceiptPath?: string | null;
}) {
  const t = useTranslations("expenses");
  const tf = useTranslations("expenses.fields");
  const tc = useTranslations("common");
  const tr = useTranslations("tracking");

  const values = { ...DEFAULT_VALUES, ...defaultValues };
  const action = mode === "create" ? createExpenseAction : updateExpenseAction;
  const [state, formAction] = useActionState(action, initialExpenseActionState);
  const [removeReceipt, setRemoveReceipt] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state?.error} />

      {mode === "edit" && expenseId ? <input type="hidden" name="id" value={expenseId} /> : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="amountUsd">{tf("amount")}</Label>
          <Input
            id="amountUsd"
            name="amountUsd"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            defaultValue={values.amountUsd}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="incurredOn">{tf("date")}</Label>
          <Input id="incurredOn" name="incurredOn" type="date" defaultValue={values.incurredOn} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="category">{tf("category")}</Label>
          <NativeSelect id="category" name="category" defaultValue={values.category}>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`category.${category}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="vehicleId">{tf("vehicle")}</Label>
          <NativeSelect id="vehicleId" name="vehicleId" defaultValue={values.vehicleId}>
            <option value="">{tr("noVehicle")}</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.nickname}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="description">
          {tf("description")} <span className="text-muted-foreground">({tc("optional")})</span>
        </Label>
        <Input id="description" name="description" defaultValue={values.description} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="receipt">
          {tf("receipt")} <span className="text-muted-foreground">({tc("optional")})</span>
        </Label>

        {existingReceiptPath ? (
          removeReceipt ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t("receiptWillBeRemoved")}</span>
              <Button type="button" variant="link" className="h-auto p-0" onClick={() => setRemoveReceipt(false)}>
                {tc("cancel")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <ReceiptThumbnail path={existingReceiptPath} />
              <Button type="button" variant="outline" size="sm" onClick={() => setRemoveReceipt(true)}>
                {t("removeReceipt")}
              </Button>
            </div>
          )
        ) : null}

        <input type="hidden" name="removeReceipt" value={removeReceipt ? "true" : "false"} />
        {/* `capture="environment"` opens the rear camera directly on phones that support it; users can still pick an existing photo instead. */}
        <Input id="receipt" name="receipt" type="file" accept="image/*" capture="environment" />
        <p className="text-muted-foreground text-xs">{t("receiptHint")}</p>
      </div>

      <SubmitButton pendingChildren={tc("save")}>{tc("save")}</SubmitButton>
    </form>
  );
}
