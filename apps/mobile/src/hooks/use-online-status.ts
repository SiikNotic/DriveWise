import { useEffect, useRef, useState } from "react";

/**
 * Capacitor's Android WebView is a real Chromium browser context, so the
 * plain browser `navigator.onLine` + online/offline events (same as
 * apps/web) work directly here — no native connectivity plugin needed the
 * way React Native's lack of a browser required one (@react-native-community/netinfo).
 */
function isOnlineNow(): boolean {
  return navigator.onLine;
}

/** For React rendering — re-renders the subscriber when connectivity changes. */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(isOnlineNow);

  useEffect(() => {
    const update = () => setIsOnline(isOnlineNow());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return isOnline;
}

/**
 * For SyncQueue's `isOnline: () => boolean` — it needs a synchronous check
 * at call time, not a hook. Kept as a ref (rather than just calling
 * `navigator.onLine` directly at each call site) to mirror the same shape
 * apps/web and the earlier React Native build both use.
 */
export function useOnlineStatusRef() {
  const ref = useRef(isOnlineNow());

  useEffect(() => {
    const update = () => {
      ref.current = isOnlineNow();
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return ref;
}
