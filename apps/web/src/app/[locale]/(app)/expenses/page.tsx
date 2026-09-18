import { PlusIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatUsd } from "@drivewise/shared";
import type { ExpenseCategory } from "@drivewise/shared";

import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/patterns/state-message";
import { DeleteExpenseDialog } from "@/components/expenses/delete-expense-dialog";

const MAX_EXPENSES = 1000;

export default async function ExpensesPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("expenses");

  const supabase = await createClient();
  const [{ data: expenses }, { data: vehicles }] = await Promise.all([
    supabase.from("expenses").select("*").order("incurred_on", { ascending: false }).limit(MAX_EXPENSES),
    supabase.from("vehicles").select("id, nickname"),
  ]);

  const vehicleName = new Map((vehicles ?? []).map((v) => [v.id, v.nickname]));
  const rows = expenses ?? [];

  const monthlyTotals = new Map<string, number>();
  const categoryTotals = new Map<ExpenseCategory, number>();
  for (const expense of rows) {
    const monthKey = expense.incurred_on.slice(0, 7);
    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) ?? 0) + expense.amount_usd);
    categoryTotals.set(
      expense.category,
      (categoryTotals.get(expense.category) ?? 0) + expense.amount_usd,
    );
  }
  const monthlyEntries = [...monthlyTotals.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  const monthFormat = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/expenses/new">
            <PlusIcon />
            {t("addExpense")}
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("monthlyTotals")}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-2">
                  {monthlyEntries.map(([monthKey, total]) => (
                    <div key={monthKey} className="flex items-center justify-between gap-2 text-sm">
                      <dt className="text-muted-foreground">
                        {monthFormat.format(new Date(`${monthKey}-01T00:00:00`))}
                      </dt>
                      <dd className="font-mono tabular-nums">{formatUsd(total, locale)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("categoryTotals")}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-2">
                  {EXPENSE_CATEGORIES.filter((category) => categoryTotals.has(category)).map((category) => (
                    <div key={category} className="flex items-center justify-between gap-2 text-sm">
                      <dt className="text-muted-foreground">{t(`category.${category}`)}</dt>
                      <dd className="font-mono tabular-nums">{formatUsd(categoryTotals.get(category)!, locale)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-2">
            {rows.map((expense) => (
              <Card key={expense.id} className="gap-3 py-3">
                <CardContent className="flex items-center justify-between gap-3 px-4">
                  <Link
                    href={`/expenses/${expense.id}/edit`}
                    className="flex min-w-0 flex-1 flex-col gap-1 hover:opacity-80"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t(`category.${expense.category}`)}</span>
                      <span className="text-muted-foreground text-xs">
                        {dateFormat.format(new Date(`${expense.incurred_on}T00:00:00`))}
                      </span>
                    </div>
                    <span className="text-muted-foreground truncate text-xs">
                      {expense.vehicle_id ? vehicleName.get(expense.vehicle_id) : null}
                      {expense.vehicle_id && expense.description ? " · " : null}
                      {expense.description}
                    </span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-metric text-sm">{formatUsd(expense.amount_usd, locale)}</span>
                    <DeleteExpenseDialog expenseId={expense.id} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
