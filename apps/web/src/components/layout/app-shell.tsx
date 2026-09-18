import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { PrimaryNav } from "@/components/layout/primary-nav";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SyncStatusBadge } from "@/components/layout/sync-status-badge";
import { SignOutButton } from "@/components/layout/sign-out-button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm">DW</span>
            <span>{t("app.name")}</span>
          </Link>
          <div className="flex items-center gap-1">
            <PrimaryNav />
            <SyncStatusBadge />
            <SignOutButton />
          </div>
        </div>
      </header>
      {/* Bottom padding + one safe-area unit clears the fixed mobile tab bar. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-8 sm:pb-8">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
