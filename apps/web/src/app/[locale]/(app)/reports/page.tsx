import { getTranslations, setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { ReportsView } from "@/components/reports/reports-view";

export default async function ReportsPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("reports");
  const tu = await getTranslations("units");

  const supabase = await createClient();
  const [{ data: vehicles }, { data: settings }] = await Promise.all([
    supabase.from("vehicles").select("*").order("created_at", { ascending: true }),
    supabase.from("user_settings").select("standard_mileage_rate_usd").maybeSingle(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <ReportsView
        vehicles={vehicles ?? []}
        standardMileageRateUsd={settings?.standard_mileage_rate_usd ?? 0}
        distanceUnitLabel={tu("mi")}
      />
    </div>
  );
}
