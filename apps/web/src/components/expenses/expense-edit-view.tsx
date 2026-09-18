"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { fetchExpenseDetail, type ExpenseDetail } from "@/lib/expenses/expense-source";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { LocalExpenseForm } from "@/components/expenses/local-expense-form";

/**
 * Branches to the right edit path depending on whether this expense has
 * synced yet: ExpenseForm (Server Action) for a synced row, LocalExpenseForm
 * (straight to IndexedDB) for one still only on this device — the same
 * dual-dispatch the underlying expense-source.ts functions already
 * implement, just reflected in which form renders.
 */
export function ExpenseEditView({
  clientId,
  userId,
  vehicles,
}: {
  clientId: string;
  userId: string;
  vehicles: { id: string; nickname: string }[];
}) {
  const te = useTranslations("errors");
  const t = useTranslations("expenses");
  const [detail, setDetail] = useState<ExpenseDetail | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetchExpenseDetail(clientId, userId).then((result) => {
      if (!cancelled) setDetail(result);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, userId]);

  if (detail === undefined) {
    return <p className="text-muted-foreground text-center text-sm">{t("empty.title")}</p>;
  }

  if (detail === null) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-muted-foreground text-sm">{te("notFound")}</p>
      </div>
    );
  }

  const { row } = detail;

  if (row.syncStatus === "synced" && row.serverId) {
    return (
      <ExpenseForm
        mode="edit"
        expenseId={row.serverId}
        vehicles={vehicles}
        existingReceiptPath={row.receiptStoragePath}
        defaultValues={{
          amountUsd: String(row.amountUsd),
          incurredOn: row.incurredOn,
          category: row.category,
          vehicleId: row.vehicleId ?? "",
          description: row.description ?? "",
        }}
      />
    );
  }

  return (
    <LocalExpenseForm
      mode="edit"
      userId={userId}
      row={row}
      vehicles={vehicles}
      defaultValues={{
        amountUsd: String(row.amountUsd),
        incurredOn: row.incurredOn,
        category: row.category,
        vehicleId: row.vehicleId ?? "",
        description: row.description ?? "",
      }}
    />
  );
}
