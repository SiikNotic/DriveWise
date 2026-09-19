import { supabase } from "../lib/supabase";

export function SettingsScreen({ email }: { email: string | undefined }) {
  return (
    <div className="min-h-screen space-y-4 bg-background p-4 pb-24">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      <div className="space-y-1 rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Signed in as</p>
        <p className="text-base font-semibold text-foreground">{email}</p>
      </div>

      <button
        className="w-full rounded-lg border border-destructive py-3.5 text-base font-semibold text-destructive"
        onClick={() => void supabase.auth.signOut()}
      >
        Sign out
      </button>
    </div>
  );
}
