import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "@drivewise/shared";

/**
 * Refreshes the Supabase auth cookie on every request that passes through
 * `proxy.ts`, writing the refreshed cookies onto `response` (produced by
 * next-intl's routing middleware) instead of a separate NextResponse — that
 * keeps the two middlewares from clobbering each other's cookies.
 *
 * This does not yet redirect unauthenticated users: there's no login screen
 * built yet (this is architecture-phase). Route protection belongs here once
 * Supabase Auth screens exist — see the "Do not run code between
 * createServerClient and getClaims()" warning in Supabase's docs before
 * adding logic to this function.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
  response: NextResponse,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // No project linked yet (see apps/web/.env.example) — skip rather than
  // throwing on every request, so the dashboard still runs during this
  // architecture phase before Supabase is provisioned.
  if (!supabaseUrl || !supabasePublishableKey) {
    return response;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getClaims() verifies the JWT locally against the project's published
  // keys on every call — unlike getSession(), it can be trusted server-side.
  await supabase.auth.getClaims();

  return response;
}
