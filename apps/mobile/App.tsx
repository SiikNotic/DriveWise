// Order matters: get-random-values before anything that might call
// crypto.getRandomValues (some @supabase/supabase-js internals do), and the
// background-location task module before this file renders anything — see
// that module's own doc comment for why `defineTask` must run at import
// time, unconditionally, rather than inside a component.
import "react-native-get-random-values";
import "./src/lib/location/background-task";

import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
