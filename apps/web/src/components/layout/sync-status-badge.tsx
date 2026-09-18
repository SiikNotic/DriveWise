"use client";

import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/patterns/status-badge";
import { useOnlineStatus } from "@/hooks/use-online-status";

/**
 * Reflects browser connectivity only — a signal for the web dashboard, not a
 * guarantee. The mobile tracking layer keeps recording GPS and queuing trips
 * locally regardless of what this badge shows; see apps/mobile/README.md.
 */
export function SyncStatusBadge() {
  const t = useTranslations("dashboard.syncStatus");
  const isOnline = useOnlineStatus();

  return (
    <StatusBadge tone={isOnline ? "positive" : "warning"} className="ml-1">
      {isOnline ? t("online") : t("offline")}
    </StatusBadge>
  );
}
