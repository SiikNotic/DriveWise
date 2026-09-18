import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthChrome } from "@/components/layout/auth-chrome";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

/**
 * Not under (auth) or (app): reaching this page means the visitor just
 * followed a password-recovery email link, which leaves them with a real
 * (recovery-scoped) session — (auth)'s "already signed in, go to
 * dashboard" guard would misfire here, and (app)'s guard is simply the
 * wrong semantics for a page whose whole point is a not-fully-signed-in visitor.
 */
export default async function ResetPasswordPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.updatePassword");

  return (
    <AuthChrome>
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <UpdatePasswordForm />
      </div>
    </AuthChrome>
  );
}
