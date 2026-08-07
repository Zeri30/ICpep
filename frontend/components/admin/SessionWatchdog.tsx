"use client";

/* Notices when this officer's session has been ended remotely — most notably
   User Management's "Log out all admins" (see UsersList.tsx), but also an
   account being deactivated or password-reset elsewhere — sooner than
   waiting on whatever page-specific polling happens to be running (the
   sidebar's counts poll is 30s and only fires from admin pages) or the next
   time this tab happens to navigate.

   Polls a near-free endpoint (MeController::ping — no queries beyond auth
   resolution) on a short interval, paused while the tab is hidden and
   caught back up with an immediate check on becoming visible again — see
   useVisibilityInterval. A backgrounded tab nobody is looking at doesn't
   need to know the instant it's signed out; catching up the moment it's
   looked at again is soon enough. The redirect itself isn't done here: a
   401 (session gone) or a 403 with reason "account_deactivated" already
   sends the browser to "/" via parse() in lib/adminApi.ts, so this
   component only has to keep asking. */

import { apiGet } from "@/lib/adminApi";
import { useVisibilityInterval } from "@/lib/useVisibilityInterval";

const CHECK_INTERVAL_MS = 10 * 1000;

export default function SessionWatchdog() {
  useVisibilityInterval(() => {
    apiGet("/me/ping").catch(() => {
      // A network blip isn't "signed out" — only the session-ending
      // statuses are, and parse() already redirects for those on its own.
    });
  }, CHECK_INTERVAL_MS);

  return null;
}
