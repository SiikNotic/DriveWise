import { getTranslations, setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { TrackingPanel } from "@/components/tracking/tracking-panel";

export default async function DashboardPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const tu = await getTranslations("units");

  const supabase = await createClient();
  const [{ data: claimsData }, { data: vehicles }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("vehicles").select("id, nickname").order("created_at", { ascending: true }),
  ]);
  const userId = claimsData?.claims.sub ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <TrackingPanel userId={userId} vehicles={vehicles ?? []} distanceUnitLabel={tu("mi")} />
    </div>
  );
}
