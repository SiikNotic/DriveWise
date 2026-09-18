import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/settings/language-switcher";

export default async function SettingsPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("language.label")}</CardTitle>
          <CardDescription>{t("language.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Label>{t("language.label")}</Label>
          <LanguageSwitcher />
          <Separator />
          <p className="text-muted-foreground text-xs">
            {t("distanceUnit.label")}: {t("distanceUnit.mi")} /{" "}
            {t("distanceUnit.km")} — {tc("comingSoon")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
