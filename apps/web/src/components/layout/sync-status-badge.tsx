"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/patterns/status-badge";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

/**
 * Reflects browser connectivity only — a signal for the web dashboard, not a
 * guarantee. The mobile tracking layer keeps recording GPS and queuing trips
 * locally regardless of what this badge shows; see apps/mobile/README.md.
 */
export function SyncStatusBadge() {
  const t = useTranslations("dashboard.syncStatus");
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <StatusBadge tone={isOnline ? "positive" : "warning"} className="ml-1">
      {isOnline ? t("online") : t("offline")}
    </StatusBadge>
  );
}
