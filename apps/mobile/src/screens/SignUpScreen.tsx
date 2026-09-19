import { useState } from "react";

import { supabase } from "../lib/supabase";

export function SignUpScreen({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSignUp() {
    setError(null);
    setBusy(true);
    // No emailRedirectTo (unlike apps/web's signup): a driver confirming
    // via a mobile browser has no app deep link to land back on, so this
    // relies on the Supabase project's email-confirmation setting — if it
    // requires confirmation, the driver confirms via the browser and then
    // simply logs in from this same screen.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });
    setBusy(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (!data.session) {
      setCheckEmail(true);
    }
    // If a session came back immediately (email confirmation disabled),
    // App.tsx's session listener switches to the app tabs.
  }

  if (checkEmail) {
    return (
      <div className="flex min-h-screen flex-col justify-center bg-background px-6">
        <div className="space-y-3">
          <h1 className="text-center text-2xl font-bold text-foreground">Check your email</h1>
          <p className="text-center text-sm text-muted-foreground">
            We sent a confirmation link to {email}. Confirm it, then come back and sign in.
          </p>
          <button className="mt-2 w-full text-center text-sm text-primary" onClick={onSwitchToLogin}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-6">
      <div className="space-y-3">
        <h1 className="text-center text-2xl font-bold text-foreground">Create your account</h1>
        <p className="text-center text-sm text-muted-foreground">Start tracking miles and earnings in minutes.</p>

        {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}

        <div className="flex gap-2">
          <input
            className="w-full flex-1 rounded-lg border border-border bg-card px-3.5 py-3 text-base text-foreground"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            className="w-full flex-1 rounded-lg border border-border bg-card px-3.5 py-3 text-base text-foreground"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="mt-2 w-full rounded-lg bg-primary py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-60"
          onClick={() => void handleSignUp()}
          disabled={busy || !email || !password || !firstName || !lastName}
        >
          {busy ? "Creating account…" : "Create account"}
        </button>

        <button className="mt-2 w-full text-center text-sm text-primary" onClick={onSwitchToLogin}>
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );
}
