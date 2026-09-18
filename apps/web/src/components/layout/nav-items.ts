import { LayoutDashboardIcon, SettingsIcon, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: "/" | "/settings";
  labelKey: "nav.dashboard" | "nav.settings";
  icon: LucideIcon;
}

/** Single source of truth for primary navigation — desktop nav and the
 * mobile tab bar both render from this list. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboardIcon },
  { href: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
];
