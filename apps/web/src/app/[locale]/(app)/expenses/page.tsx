import { setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { ExpensesList } from "@/components/expenses/expenses-list";

export default async function ExpensesPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const [{ data: claimsData }, { data: vehicles }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("vehicles").select("id, nickname"),
  ]);
  const userId = claimsData?.claims.sub ?? "";

  return <ExpensesList userId={userId} vehicles={vehicles ?? []} />;
}
