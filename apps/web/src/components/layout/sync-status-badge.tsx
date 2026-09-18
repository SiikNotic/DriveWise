"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

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
    <span
      className={cn(
        "ml-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        isOnline
          ? "bg-success/15 text-success"
          : "bg-warning/15 text-warning",
      )}
      title={t("label")}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isOnline ? "bg-success" : "bg-warning",
        )}
      />
      {isOnline ? t("online") : t("offline")}
    </span>
  );
}
