import { createClient } from "@supabase/supabase-js";
import type { Database } from "@drivewise/shared";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — copy .env.example to .env.local and fill in your Supabase project's values (the same project apps/web uses).",
  );
}

/**
 * The single Supabase client for the mobile app — same project, same
 * `Database` type, as apps/web. Capacitor's Android WebView is a real
 * Chromium browser context, so the browser-default `localStorage` session
 * storage (same as apps/web) just works — no AsyncStorage/SecureStore
 * polyfill needed the way React Native required.
 */
export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
