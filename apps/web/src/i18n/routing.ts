import { defineRouting } from "next-intl/routing";

/**
 * Locale registry for the whole app. Adding a language later means:
 * add it here, add messages/<locale>.json, and add it to the Settings
 * language picker — no other routing changes needed.
 */
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
