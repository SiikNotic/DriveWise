import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthChrome } from "@/components/layout/auth-chrome";

/**
 * Login/sign-up/forgot-password: no app chrome, and a signed-in user gets
 * bounced straight to the dashboard instead of seeing a login form again.
 *
 * reset-password is deliberately NOT under this group — a password-recovery
 * link leaves the visitor with a real (recovery-scoped) session by design,
 * and this guard would otherwise redirect them straight past the "choose a
 * new password" form and back to the dashboard.
 */
export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect({ href: "/", locale });
  }

  return <AuthChrome>{children}</AuthChrome>;
}
