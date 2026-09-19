import { useEffect, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

/** For React rendering — re-renders the subscriber when connectivity changes. */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
  }, []);

  return isOnline;
}

/**
 * For SyncQueue's `isOnline: () => boolean` — it needs a synchronous check
 * at call time, not a hook. NetInfo has no synchronous getter, so this
 * keeps a ref updated from the same listener and hands back a closure over
 * it, wired up once per component that needs it (see useTripRecorder).
 */
export function useOnlineStatusRef() {
  const ref = useRef(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      ref.current = Boolean(state.isConnected && state.isInternetReachable !== false);
    });
  }, []);

  return ref;
}
