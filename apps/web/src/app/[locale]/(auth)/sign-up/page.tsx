import { getTranslations, setRequestLocale } from "next-intl/server";

import { SignUpForm } from "@/components/auth/sign-up-form";

export default async function SignUpPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.signUp");

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <SignUpForm />
    </div>
  );
}
