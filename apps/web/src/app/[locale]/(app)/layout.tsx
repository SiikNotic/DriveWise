import { AppShell } from "@/components/layout/app-shell";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Every route under this group requires a session. This is a UX/routing
 * convenience, not the security boundary — RLS on the tables themselves is
 * what actually protects the data; this just avoids rendering a page the
 * user can't use and bounces them to /login instead.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect({ href: "/login", locale });
  }

  return <AppShell>{children}</AppShell>;
}
