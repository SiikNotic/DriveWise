import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

/**
 * Handles both signup confirmation and password-recovery links. Supabase's
 * default email templates use `{{ .ConfirmationURL }}`, which does NOT hit
 * this route — they must be changed to:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}
 * for "Confirm signup", and the same with type=recovery for "Reset
 * Password". See README.md's Supabase section — this is a one-time
 * project-settings change this repo's tooling can't make for you.
 *
 * Not under [locale]: this exact path is what's registered as the redirect
 * target, so it must never get a locale prefix rewritten onto it (see
 * proxy.ts's matcher).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? `/${routing.defaultLocale}`;

  // On failure, land on the login page (which knows how to show an error
  // banner) rather than a dead-end page — there's no session to protect
  // yet either way.
  const failureRedirect = request.nextUrl.clone();
  failureRedirect.pathname = `/${routing.defaultLocale}/login`;
  failureRedirect.search = "";
  failureRedirect.searchParams.set("error", "confirm_failed");

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      // `next` is whatever was passed as emailRedirectTo/redirectTo — the
      // email template echoes it back as a full URL via {{ .RedirectTo }},
      // but handle a bare path too in case a template only forwards the path.
      let destination: URL;
      try {
        destination = new URL(next);
      } catch {
        destination = request.nextUrl.clone();
        destination.pathname = next.startsWith("/") ? next : `/${next}`;
        destination.search = "";
      }
      return NextResponse.redirect(destination);
    }
  }

  return NextResponse.redirect(failureRedirect);
}
