"use client";

/* What someone sees when they scan an event QR without a live session.

   The requirement this exists for: an officer who is signed out must be
   prompted to sign in and come back here — on a phone, in a room, with the
   meeting already started. Redirecting them to the landing page (which is what
   the admin shell does with an expired session) loses the token, and the token
   is the whole scan.

   So the URL is kept exactly as it arrived and handed to the sign-in modal as
   where to go afterwards. Signing in returns to this page with its token
   intact, and the check-in runs itself. */

import { LogIn, QrCode } from "lucide-react";
import { useState } from "react";
import Logo from "@/components/ui/Logo";
import SignInModal from "@/components/ui/SignInModal";

export default function CheckInSignIn({ token }: { token: string | null }) {
  const [open, setOpen] = useState(false);

  // Rebuilt from the token the server already parsed rather than read off
  // window.location, so it is the same string on the server and on the client
  // and needs no effect to discover. The token is the whole scan; losing it
  // across the login is the failure this page exists to prevent.
  const returnTo = token
    ? `/admin/check-in?token=${encodeURIComponent(token)}`
    : "/admin/check-in";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo size={44} className="h-11 w-11" />
          <h1 className="mt-4 font-display text-2xl font-black uppercase tracking-wide text-foreground">
            Attendance
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">ICpEP.SE officers</p>
        </div>

        <div className="mt-6 rounded-xl border border-line bg-card p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-secondary text-primary">
            <QrCode size={26} />
          </span>

          <p className="mt-4 font-display text-lg font-black uppercase tracking-wide text-foreground">
            Sign in to check in
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Attendance is recorded against your officer account, so we need to
            know who you are. You will come straight back here.
          </p>

          <button
            type="button"
            onClick={() => setOpen(true)}
            // Tall and full width: pressed with a thumb, standing up.
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 font-head text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-accent"
          >
            <LogIn size={16} /> Sign in
          </button>

          {/* Members do not have accounts and never will, and someone who is not
              an officer needs to be told that rather than left trying passwords. */}
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Officers only. If you do not have an account, ask the Programming
            Team.
          </p>
        </div>
      </div>

      <SignInModal open={open} onClose={() => setOpen(false)} redirectTo={returnTo} />
    </main>
  );
}
