"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * A plain HTML form POSTing to the /auth/signout route handler — works
 * even with JS disabled, since the route handler is the real sign-out
 * (re-checks the session before calling supabase.auth.signOut() rather
 * than trusting the request). The onSubmit here is best-effort hygiene on
 * top of that, not a security boundary: on a shared device, a previous
 * user's offline trips/expenses would otherwise sit in this origin's
 * IndexedDB indefinitely after logout — inaccessible to the next signed-in
 * user (every read is filtered by their own authenticated user id — see
 * IndexedDbTripStore/IndexedDbExpenseStore), but still inspectable via
 * browser devtools. Clearing it here removes that residue without
 * blocking or delaying the actual sign-out if it's slow or unsupported.
 */
export function SignOutButton() {
  const t = useTranslations("auth");

  function clearLocalData() {
    try {
      indexedDB.deleteDatabase("drivewise-tracking");
      indexedDB.deleteDatabase("drivewise-expenses");
    } catch {
      // Best-effort only — never block sign-out on this.
    }
  }

  return (
    <form action="/auth/signout" method="post" onSubmit={clearLocalData}>
      <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
        <LogOutIcon className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t("signOut")}</span>
      </Button>
    </form>
  );
}
