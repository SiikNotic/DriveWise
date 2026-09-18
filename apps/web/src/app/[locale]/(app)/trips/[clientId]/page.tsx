import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { TripDetail } from "@/components/trips/trip-detail";

export default async function TripDetailPage(props: {
  params: Promise<{ locale: string; clientId: string }>;
}) {
  const { locale, clientId } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("trips");
  const tu = await getTranslations("units");

  const supabase = await createClient();
  const [{ data: claimsData }, { data: vehicles }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("vehicles").select("*"),
  ]);
  const userId = claimsData?.claims.sub ?? "";

  return (
    <div className="flex flex-col gap-6">
      <Link href="/trips" className="text-muted-foreground w-fit text-sm hover:underline">
        &larr; {t("detailBack")}
      </Link>

      <TripDetail
        clientId={clientId}
        userId={userId}
        vehicles={vehicles ?? []}
        distanceUnitLabel={tu("mi")}
        hourUnitLabel={tu("hr")}
      />
    </div>
  );
}
