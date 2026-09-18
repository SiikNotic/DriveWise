"use client";

import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("settings.language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function handleSelect(nextLocale: AppLocale) {
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {routing.locales.map((loc) => (
        <Button
          key={loc}
          type="button"
          variant={loc === locale ? "default" : "outline"}
          aria-pressed={loc === locale}
          onClick={() => handleSelect(loc)}
        >
          {t(loc)}
        </Button>
      ))}
    </div>
  );
}
