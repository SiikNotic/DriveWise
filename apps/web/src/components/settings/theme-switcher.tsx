"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

const OPTIONS = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
  { value: "system", Icon: Monitor },
] as const;

export function ThemeSwitcher() {
  const t = useTranslations("settings.appearance.theme");
  const { theme, setTheme } = useTheme();
  // Avoid rendering the (system-resolved) active state before the client
  // has mounted, since the server can't know the OS preference.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex flex-wrap gap-2" aria-label={t("label")}>
      {OPTIONS.map(({ value, Icon }) => {
        const isActive = mounted && theme === value;
        return (
          <Button
            key={value}
            type="button"
            variant={isActive ? "default" : "outline"}
            aria-pressed={isActive}
            onClick={() => setTheme(value)}
            className="gap-2"
          >
            <Icon aria-hidden="true" />
            {t(value)}
          </Button>
        );
      })}
    </div>
  );
}
