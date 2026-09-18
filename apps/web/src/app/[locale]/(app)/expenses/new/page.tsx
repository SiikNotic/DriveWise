import { getTranslations, setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LocalExpenseForm } from "@/components/expenses/local-expense-form";

export default async function NewExpensePage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("expenses");

  const supabase = await createClient();
  const [{ data: claimsData }, { data: vehicles }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("vehicles").select("id, nickname"),
  ]);
  const userId = claimsData?.claims.sub ?? "";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("addExpense")}</h1>
      </div>

      <Card>
        <CardHeader className="sr-only">
          <CardTitle>{t("addExpense")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LocalExpenseForm mode="create" userId={userId} vehicles={vehicles ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
