import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

/**
 * A plain POST form target (see components/layout/sign-out-button.tsx) —
 * no client JS needed. Re-checks the session before signing out rather
 * than trusting the request; not under [locale] for the same reason as
 * /auth/confirm (see proxy.ts's matcher).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    await supabase.auth.signOut();
  }

  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value ?? "";
  const locale = (routing.locales as readonly string[]).includes(cookieLocale)
    ? cookieLocale
    : routing.defaultLocale;

  return NextResponse.redirect(new URL(`/${locale}/login`, request.url), {
    status: 302,
  });
}
