import { PlusIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/patterns/state-message";
import { VehicleCard } from "@/components/vehicles/vehicle-card";

export default async function VehiclesPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("vehicles");
  const tu = await getTranslations("units");

  const supabase = await createClient();
  const [{ data: vehicles }, { data: settings }] = await Promise.all([
    supabase.from("vehicles").select("*").order("created_at", { ascending: true }),
    supabase.from("user_settings").select("default_vehicle_id").maybeSingle(),
  ]);

  const activeVehicleId = settings?.default_vehicle_id ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/vehicles/new">
            <PlusIcon />
            {t("addVehicle")}
          </Link>
        </Button>
      </div>

      {vehicles && vehicles.length > 0 ? (
        <div className="flex flex-col gap-3">
          {vehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              isActive={vehicle.id === activeVehicleId}
              locale={locale}
              distanceUnitLabel={tu("mi")}
              activeLabel={t("active")}
            />
          ))}
        </div>
      ) : (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      )}
    </div>
  );
}
