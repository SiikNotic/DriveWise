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
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { ProfileForm } from "@/components/settings/profile-form";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  const [{ data: userData }, { data: claimsData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
  ]);
  const userId = claimsData?.claims.sub;

  const { data: profile } = userId
    ? await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.title")}</CardTitle>
          <CardDescription>{t("profile.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            email={userData.user?.email ?? ""}
            defaultValues={{
              firstName: profile?.first_name ?? "",
              lastName: profile?.last_name ?? "",
              phone: profile?.phone ?? "",
              country: profile?.country ?? "",
              state: profile?.state ?? "",
            }}
          />
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>{t("appearance.title")}</CardTitle>
          <CardDescription>{t("appearance.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Label>{t("appearance.theme.label")}</Label>
          <ThemeSwitcher />
        </CardContent>
      </Card>
    </div>
  );
}
