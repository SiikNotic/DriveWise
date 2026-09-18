"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";

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
  const leftItems = primaryItems.slice(0, 2);
  const rightItems = primaryItems.slice(2);
  const overflowItems = NAV_ITEMS.filter((item) => !MOBILE_PRIMARY_HREFS.includes(item.href));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] sm:hidden"
        aria-label={t("nav.dashboard")}
      >
        <div className="relative mx-auto flex h-[78px] max-w-md items-end justify-between rounded-[2rem] bg-[#242424] px-4 pb-2 shadow-[0_16px_35px_-18px_rgba(15,23,42,0.9)]">
          <span aria-hidden="true" className="pointer-events-none absolute -top-9 left-1/2 size-24 -translate-x-1/2 rounded-full bg-background" />
          <div className="relative z-10 flex min-w-0 flex-1 items-end justify-around">
            {leftItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-14 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-medium transition-all duration-300",
                    isActive ? "-translate-y-0.5 text-[#a76cff]" : "text-white/75 hover:text-white",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="max-w-16 truncate">{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label={t("nav.more")}
            className="absolute left-1/2 top-1/2 z-20 grid size-[74px] -translate-x-1/2 -translate-y-[76%] place-items-center rounded-full bg-[#7026c7] text-white shadow-[0_10px_24px_-6px_rgba(112,38,199,0.9)] transition-transform duration-300 hover:scale-105 active:scale-95"
          >
            <PlusIcon className="size-9 stroke-[1.5]" aria-hidden="true" />
          </button>
          <div className="relative z-10 flex min-w-0 flex-1 items-end justify-around">
            {rightItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-14 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-medium transition-all duration-300",
                    isActive ? "-translate-y-0.5 text-[#a76cff]" : "text-white/75 hover:text-white",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="max-w-16 truncate">{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </div>
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
