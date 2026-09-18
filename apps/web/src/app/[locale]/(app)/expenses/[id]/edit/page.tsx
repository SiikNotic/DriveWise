import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExpenseForm } from "@/components/expenses/expense-form";

export default async function EditExpensePage(props: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("expenses");

  const supabase = await createClient();
  const [{ data: expense }, { data: vehicles }] = await Promise.all([
    supabase.from("expenses").select("*").eq("id", id).maybeSingle(),
    supabase.from("vehicles").select("id, nickname"),
  ]);

  if (!expense) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("editExpense")}</h1>
      </div>

      <Card>
        <CardHeader className="sr-only">
          <CardTitle>{t("editExpense")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpenseForm
            mode="edit"
            expenseId={expense.id}
            vehicles={vehicles ?? []}
            existingReceiptPath={expense.receipt_storage_path}
            defaultValues={{
              amountUsd: String(expense.amount_usd),
              incurredOn: expense.incurred_on,
              category: expense.category,
              vehicleId: expense.vehicle_id ?? "",
              description: expense.description ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
