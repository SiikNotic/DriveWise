"use client";

import { useEffect } from "react";

/**
 * Registers the minimal offline app-shell cache (public/sw.js) — see that
 * file's own comment for exactly what it does and doesn't cover.
 * Production-only: a service worker intercepting requests during local
 * dev would fight Next's own dev-server caching/HMR.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Best-effort only — the app still works online-only without it.
    });
  }, []);

  return null;
}
