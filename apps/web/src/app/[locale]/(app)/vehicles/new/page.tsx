import { getTranslations, setRequestLocale } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VehicleForm } from "@/components/vehicles/vehicle-form";

export default async function NewVehiclePage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("vehicles");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("addTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("addSubtitle")}</p>
      </div>

      <Card>
        <CardHeader className="sr-only">
          <CardTitle>{t("addTitle")}</CardTitle>
          <CardDescription>{t("addSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <VehicleForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
