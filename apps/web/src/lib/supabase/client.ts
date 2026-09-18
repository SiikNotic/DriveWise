import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@drivewise/shared";

/**
 * Browser-side Supabase client. Safe to call anywhere in Client Components —
 * @supabase/ssr dedupes this into a singleton per browser tab.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
