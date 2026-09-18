import { getTranslations, setRequestLocale } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ locale }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  setRequestLocale(locale);
  const t = await getTranslations("auth.signIn");

  const prefillError =
    searchParams.error === "confirm_failed" ? t("confirmFailed") : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <LoginForm prefillError={prefillError} />
    </div>
  );
}
