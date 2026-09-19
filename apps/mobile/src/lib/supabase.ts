import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@drivewise/shared";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY — copy .env.example to .env.local and fill in your Supabase project's values (the same project apps/web uses).",
  );
}

/**
 * The single Supabase client for the mobile app — same project, same
 * `Database` type, as apps/web. Session storage is AsyncStorage (not
 * SecureStore): a JWT session plus refresh token can exceed SecureStore's
 * ~2KB per-item limit, which is why Supabase's own React Native guidance
 * uses AsyncStorage here despite it being less secure at rest than the
 * Keychain/Keystore-backed SecureStore. `autoRefreshToken` needs the app to
 * periodically call `supabase.auth.startAutoRefresh()`/`stopAutoRefresh()`
 * around the app's foreground/background state — wired in App.tsx.
 */
export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
