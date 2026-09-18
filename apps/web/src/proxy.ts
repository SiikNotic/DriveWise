import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

const handleI18nRouting = createMiddleware(routing);

/**
 * Next.js 16 renamed `middleware.ts`/`export function middleware` to
 * `proxy.ts`/`export function proxy`. Only one proxy can run per request, so
 * locale routing and the Supabase session refresh are composed here: intl
 * produces the response (locale redirect/rewrite + its own cookies), then
 * Supabase's refreshed auth cookies are written onto that same response.
 */
export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  return refreshSupabaseSession(request, response);
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
