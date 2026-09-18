"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { isNavItemActive, NAV_ITEMS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/**
 * Thumb-reachable bottom navigation for phones — the standard gig-driver-app
 * pattern (DoorDash/Uber/Instacart all put primary nav within thumb reach at
 * the bottom, not a hamburger menu). Hidden from `sm` up, where PrimaryNav
 * takes over. Fixed, so it never scrolls out of reach; content gets bottom
 * padding (see AppShell) so nothing sits underneath it.
 */
export function MobileTabBar() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)] sm:hidden"
      aria-label={t("nav.dashboard")}
    >
      <div className="mx-auto flex max-w-5xl">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
