import { useState } from "react";
import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { useSession } from "./hooks/use-session";
import { LoginScreen } from "./screens/LoginScreen";
import { SignUpScreen } from "./screens/SignUpScreen";
import { TrackingScreen } from "./screens/TrackingScreen";
import { TripsScreen } from "./screens/TripsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

// EXPO_PUBLIC_SENTRY_DSN's Vite equivalent — a public identifier, not a
// secret, safe to embed in the built app. Sentry.init() is a no-op without
// a dsn, so this stays harmless until one is configured. @sentry/capacitor
// wraps @sentry/react and additionally captures native-layer crashes in
// the Android WebView shell, not just JS exceptions.
Sentry.init(
  {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    tracesSampleRate: 0,
  },
  SentryReact.init,
);

type AppTab = "tracking" | "trips" | "settings";
type AuthScreen = "login" | "signup";

function AuthFlow() {
  const [screen, setScreen] = useState<AuthScreen>("login");
  return screen === "login" ? (
    <LoginScreen onSwitchToSignUp={() => setScreen("signup")} />
  ) : (
    <SignUpScreen onSwitchToLogin={() => setScreen("login")} />
  );
}

const TABS: { id: AppTab; label: string }[] = [
  { id: "tracking", label: "Tracking" },
  { id: "trips", label: "Trips" },
  { id: "settings", label: "Settings" },
];

function AppTabs({ userId, email }: { userId: string; email: string | undefined }) {
  const [tab, setTab] = useState<AppTab>("tracking");

  return (
    <div className="min-h-screen">
      {tab === "tracking" ? <TrackingScreen userId={userId} /> : null}
      {tab === "trips" ? <TripsScreen userId={userId} /> : null}
      {tab === "settings" ? <SettingsScreen email={email} /> : null}

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex-1 py-3 text-sm font-medium ${tab === item.id ? "text-primary" : "text-muted-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Switches between the auth flow and the tracking app based on Supabase session state — the mobile equivalent of apps/web's (auth)/(app) route groups. */
function Root() {
  const { session, loaded } = useSession();

  if (!loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-background" />;
  }

  return session ? (
    <AppTabs userId={session.user.id} email={session.user.email} />
  ) : (
    <AuthFlow />
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  );
}
