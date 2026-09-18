import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { SyncStatusBadge } from "@/components/layout/sync-status-badge";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();

  const navItems = [
    { href: "/", label: t("nav.dashboard") },
    { href: "/settings", label: t("nav.settings") },
  ] as const;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-base font-semibold">{t("app.name")}</span>
          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </Link>
            ))}
            <SyncStatusBadge />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
