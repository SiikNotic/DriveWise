import { CarIcon, LayoutDashboardIcon, SettingsIcon, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: "/" | "/vehicles" | "/settings";
  labelKey: "nav.dashboard" | "nav.vehicles" | "nav.settings";
  icon: LucideIcon;
}

/** Single source of truth for primary navigation — desktop nav and the
 * mobile tab bar both render from this list. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboardIcon },
  { href: "/vehicles", labelKey: "nav.vehicles", icon: CarIcon },
  { href: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
];

/** "/" only matches exactly (else every route would highlight Dashboard);
 * other items also match their own sub-routes (e.g. /vehicles/new). */
export function isNavItemActive(pathname: string, href: NavItem["href"]): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
