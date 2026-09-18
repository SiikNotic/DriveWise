import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { PrimaryNav } from "@/components/layout/primary-nav";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SyncStatusBadge } from "@/components/layout/sync-status-badge";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <Link href="/" className="text-base font-semibold tracking-tight">
            {t("app.name")}
          </Link>
          <div className="flex items-center gap-1">
            <PrimaryNav />
            <SyncStatusBadge />
          </div>
        </div>
      </header>
      {/* Bottom padding + one safe-area unit clears the fixed mobile tab bar. */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-20 sm:pb-6">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
