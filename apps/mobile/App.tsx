// Order matters: get-random-values before anything that might call
// crypto.getRandomValues (some @supabase/supabase-js internals do), and the
// background-location task module before this file renders anything — see
// that module's own doc comment for why `defineTask` must run at import
// time, unconditionally, rather than inside a component.
import "react-native-get-random-values";
import "./src/lib/location/background-task";

import { Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Sentry from "@sentry/react-native";

import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { RootNavigator } from "./src/navigation/RootNavigator";

// The one thing an on-device try/catch or ErrorBoundary can never see: a
// crash below the JS runtime (native/JSI). Sentry's RN SDK bundles Android's
// native crash handler and reports it here on the next launch — the only
// way we have to see what's actually failing on a driver's phone without a
// debugger attached to it. EXPO_PUBLIC_SENTRY_DSN is a public identifier
// (like the Mapbox token apps/web uses), not a secret — safe to embed in
// the built app. With it unset (no account configured yet), this is a
// harmless no-op: Sentry.init requires a dsn to do anything.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableNative: true,
  tracesSampleRate: 0,
});

// A driver's crash report is just "the app closed" with zero detail — there
// is no debugger attached to their phone. This surfaces the JS error
// message on screen (via an Alert) for anything the default handler would
// otherwise take the app down for silently: an uncaught exception in an
// event handler, a timer callback, or a promise rejection nothing else
// catches. It can't do anything about a genuine native/JSI-level crash —
// only about JS-level ones — but it turns those from "no information at
// all" into "here's the exact message," which is the only way to debug a
// crash we can't reproduce ourselves.
const previousHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  Alert.alert(isFatal ? "Fatal error" : "Error", `${error.message}\n\n${error.stack ?? ""}`);
  previousHandler(error, isFatal);
});

function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(App);
