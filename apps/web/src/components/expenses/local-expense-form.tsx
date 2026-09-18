"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ExpenseCategory } from "@drivewise/shared";

import { useRouter } from "@/i18n/navigation";
import {
  attachReceiptIfOnline,
  createExpenseLocal,
  updateExpenseRecord,
  type ExpenseListRow,
} from "@/lib/expenses/expense-source";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/forms/form-error";

export interface LocalExpenseFormValues {
  amountUsd: string;
  incurredOn: string;
  category: string;
  vehicleId: string;
  description: string;
}

const DEFAULT_VALUES: LocalExpenseFormValues = {
  amountUsd: "",
  incurredOn: new Date().toISOString().slice(0, 10),
  category: "fuel",
  vehicleId: "",
  description: "",
};

/**
 * The offline-capable counterpart to ExpenseForm: used for creating a new
 * expense (always — even online, so the code path is identical either
 * way) and for editing one still local to this device. Writes straight to
 * IndexedDB with no Server Action involved, so it works with no
 * connection at all; the background sync queue (useExpenseSync) takes it
 * from there. Editing an already-synced expense still goes through
 * ExpenseForm's Server Action path — see expense-source.ts's dual
 * dispatch for why.
 */
export function LocalExpenseForm({
  mode,
  userId,
  row,
  vehicles,
  defaultValues,
}: {
  mode: "create" | "edit";
  userId: string;
  /** Required in edit mode — the local row being edited. */
  row?: ExpenseListRow;
  vehicles: { id: string; nickname: string }[];
  defaultValues?: Partial<LocalExpenseFormValues>;
}) {
  const t = useTranslations("expenses");
  const tf = useTranslations("expenses.fields");
  const tc = useTranslations("common");
  const tr = useTranslations("tracking");
  const te = useTranslations("errors");
  const router = useRouter();

  const values = { ...DEFAULT_VALUES, ...defaultValues };
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);

    const formData = new FormData(event.currentTarget);
    const amountUsd = Number(formData.get("amountUsd"));
    const incurredOn = String(formData.get("incurredOn") ?? "");
    const category = String(formData.get("category") ?? "") as ExpenseCategory;
    const vehicleId = String(formData.get("vehicleId") ?? "") || null;
    const description = String(formData.get("description") ?? "") || null;
    const receiptFile = formData.get("receipt");

    if (!Number.isFinite(amountUsd) || amountUsd < 0 || !incurredOn) {
      setError(te("generic"));
      setSubmitting(false);
      return;
    }

    try {
      let clientId: string;
      if (mode === "create") {
        clientId = await createExpenseLocal({ userId, vehicleId, category, amountUsd, incurredOn, description });
      } else {
        clientId = row!.clientId;
        const result = await updateExpenseRecord(row!, { vehicleId, category, amountUsd, incurredOn, description });
        if (result.error) {
          setError(result.error);
          setSubmitting(false);
          return;
        }
      }

      if (receiptFile instanceof File && receiptFile.size > 0) {
        await attachReceiptIfOnline(clientId, userId, receiptFile);
      }

      router.push("/expenses");
    } catch {
      setError(te("generic"));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError message={error} />

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
        <Input id="receipt" name="receipt" type="file" accept="image/*" capture="environment" />
        <p className="text-muted-foreground text-xs">{t("receiptHint")}</p>
        <p className="text-muted-foreground text-xs">{t("receiptRequiresConnection")}</p>
      </div>

      <Button type="submit" disabled={submitting}>
        {tc("save")}
      </Button>
    </form>
  );
}
