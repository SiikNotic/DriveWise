import { useState } from "react";

import { supabase } from "../lib/supabase";

export function LoginScreen({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) setError(signInError.message);
    // On success, the session listener in App.tsx switches to the app tabs automatically.
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-6">
      <div className="space-y-3">
        <h1 className="text-center text-3xl font-bold text-foreground">DriveWise</h1>
        <p className="text-center text-sm text-muted-foreground">Sign in to keep tracking your earnings.</p>

        {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}

        <input
          className="w-full rounded-lg border border-border bg-card px-3.5 py-3 text-base text-foreground"
          placeholder="Email"
          type="email"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-border bg-card px-3.5 py-3 text-base text-foreground"
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="mt-2 w-full rounded-lg bg-primary py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-60"
          onClick={() => void handleSignIn()}
          disabled={busy || !email || !password}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <button className="mt-2 w-full text-center text-sm text-primary" onClick={onSwitchToSignUp}>
          Don&apos;t have an account? Create one
        </button>
      </div>
    </div>
  );
}
