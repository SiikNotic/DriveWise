"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontalIcon } from "lucide-react";

import { Link, usePathname } from "@/i18n/navigation";
import { isNavItemActive, MOBILE_PRIMARY_HREFS, NAV_ITEMS } from "@/components/layout/nav-items";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Thumb-reachable bottom navigation for phones — the standard gig-driver-app
 * pattern (DoorDash/Uber/Instacart all put primary nav within thumb reach at
 * the bottom, not a hamburger menu). Hidden from `sm` up, where PrimaryNav
 * takes over. Fixed, so it never scrolls out of reach; content gets bottom
 * padding (see AppShell) so nothing sits underneath it.
 *
 * Only MOBILE_PRIMARY_HREFS get a direct tab — with eight nav destinations
 * total, a tab per item would make each one too narrow to tap reliably.
 * Everything else lives behind "More".
 */
export function MobileTabBar() {
  const t = useTranslations();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = NAV_ITEMS.filter((item) => MOBILE_PRIMARY_HREFS.includes(item.href));
  const overflowItems = NAV_ITEMS.filter((item) => !MOBILE_PRIMARY_HREFS.includes(item.href));
  const isOverflowActive = overflowItems.some((item) => isNavItemActive(pathname, item.href));

  return (
    <>
      <nav
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 sm:hidden"
        aria-label={t("nav.dashboard")}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-0.5 rounded-2xl border border-border/60 bg-card/95 p-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/85">
          {primaryItems.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "pressable flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {t(item.labelKey)}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-current={isOverflowActive ? "page" : undefined}
            className={cn(
              "pressable flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors",
              isOverflowActive ? "bg-primary/10 text-primary" : "text-muted-foreground",
            )}
          >
            <MoreHorizontalIcon className="size-5" aria-hidden="true" />
            {t("nav.more")}
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="sm:hidden">
          <DialogHeader>
            <DialogTitle>{t("nav.more")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            {overflowItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
