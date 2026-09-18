import { defineRouting } from "next-intl/routing";

/**
 * Locale registry for the whole app. Adding a language later means:
 * add it here, add messages/<locale>.json, and add it to the Settings
 * language picker — no other routing changes needed.
 */
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "always",
  // Without an explicit maxAge, next-intl's default locale cookie has no
  // expiry set, so browsers treat it as a session cookie and drop it on
  // close — the language choice would not survive reopening the app. A
  // year matches how long a driver's language preference should stick.
  localeCookie: {
    maxAge: ONE_YEAR_IN_SECONDS,
  },
});

export type AppLocale = (typeof routing.locales)[number];
