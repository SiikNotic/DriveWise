import {
  BarChart3Icon,
  CalculatorIcon,
  CarIcon,
  LayoutDashboardIcon,
  MapIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: "/" | "/trips" | "/offers" | "/analytics" | "/vehicles" | "/settings";
  labelKey: "nav.dashboard" | "nav.trips" | "nav.offers" | "nav.analytics" | "nav.vehicles" | "nav.settings";
  icon: LucideIcon;
}

/** Single source of truth for primary navigation — desktop nav and the
 * mobile tab bar both render from this list. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboardIcon },
  { href: "/trips", labelKey: "nav.trips", icon: MapIcon },
  { href: "/offers", labelKey: "nav.offers", icon: CalculatorIcon },
  { href: "/analytics", labelKey: "nav.analytics", icon: BarChart3Icon },
  { href: "/vehicles", labelKey: "nav.vehicles", icon: CarIcon },
  { href: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
];

/** "/" only matches exactly (else every route would highlight Dashboard);
 * other items also match their own sub-routes (e.g. /vehicles/new). */
export function isNavItemActive(pathname: string, href: NavItem["href"]): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
