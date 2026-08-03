"use client";

/* Notices when this officer's session has been ended remotely — most notably
   User Management's "Log out all admins" (see UsersList.tsx), but also an
   account being deactivated or password-reset elsewhere — sooner than
   waiting on whatever page-specific polling happens to be running (the
   sidebar's counts poll is 30s and only fires from admin pages) or the next
   time this tab happens to navigate.

   Polls a near-free endpoint (MeController::ping — no queries beyond auth
   resolution) on a short interval. The redirect itself isn't done here: a
   401 (session gone) or a 403 with reason "account_deactivated" already
   sends the browser to "/" via parse() in lib/adminApi.ts, so this
   component only has to keep asking. */

import { useEffect } from "react";
import { apiGet } from "@/lib/adminApi";

const CHECK_INTERVAL_MS = 10 * 1000;

export default function SessionWatchdog() {
  useEffect(() => {
    const check = () => {
      apiGet("/me/ping").catch(() => {
        // A network blip isn't "signed out" — only the session-ending
        // statuses are, and parse() already redirects for those on its own.
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") check();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    const interval = setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  return null;
}
