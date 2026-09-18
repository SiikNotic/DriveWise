import { LogOutIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

/**
 * A plain HTML form POSTing to the /auth/signout route handler — no client
 * JS needed, and it works even if the session is already stale (the route
 * handler re-checks before calling supabase.auth.signOut()).
 */
export async function SignOutButton() {
  const t = await getTranslations("auth");

  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
        <LogOutIcon className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t("signOut")}</span>
      </Button>
    </form>
  );
}
