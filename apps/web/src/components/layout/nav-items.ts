import {
  BarChart3Icon,
  CalculatorIcon,
  CarIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  MapIcon,
  ReceiptIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export type NavHref =
  | "/"
  | "/trips"
  | "/offers"
  | "/analytics"
  | "/expenses"
  | "/reports"
  | "/vehicles"
  | "/settings";

export interface NavItem {
  href: NavHref;
  labelKey:
    | "nav.dashboard"
    | "nav.trips"
    | "nav.offers"
    | "nav.analytics"
    | "nav.expenses"
    | "nav.reports"
    | "nav.vehicles"
    | "nav.settings";
  icon: LucideIcon;
}

/** Single source of truth for primary navigation — the desktop nav renders
 * every item; the mobile bottom tab bar renders only MOBILE_PRIMARY_HREFS
 * directly and folds the rest behind its own "More" entry (eight items is
 * too many for a fixed thumb-reach bar on a phone). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboardIcon },
  { href: "/trips", labelKey: "nav.trips", icon: MapIcon },
  { href: "/offers", labelKey: "nav.offers", icon: CalculatorIcon },
  { href: "/analytics", labelKey: "nav.analytics", icon: BarChart3Icon },
  { href: "/expenses", labelKey: "nav.expenses", icon: ReceiptIcon },
  { href: "/reports", labelKey: "nav.reports", icon: FileTextIcon },
  { href: "/vehicles", labelKey: "nav.vehicles", icon: CarIcon },
  { href: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
];

/** The four a driver reaches for most often while working; everything else lives behind "More" on mobile. */
export const MOBILE_PRIMARY_HREFS: NavHref[] = ["/", "/trips", "/offers", "/vehicles"];

/** "/" only matches exactly (else every route would highlight Dashboard);
 * other items also match their own sub-routes (e.g. /vehicles/new). */
export function isNavItemActive(pathname: string, href: NavItem["href"]): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
