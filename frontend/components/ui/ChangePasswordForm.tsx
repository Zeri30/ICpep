"use client";

/* The forced first-login screen: shown in place of the whole admin shell to
   an account still on its system-generated password (see
   app/change-password/page.tsx and the (admin) layout's redirect). Styled
   like SignInModal's card since this sits in the same family of
   authentication-adjacent screens, just as a full page rather than an
   overlay — there's nothing behind it to dim. */

import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import Logo from "@/components/ui/Logo";
import { apiSend, signOut } from "@/lib/adminApi";

const fieldBase =
  "w-full rounded-md bg-secondary/60 border border-line px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/40";

type Status = "idle" | "submitting" | "done";

export default function ChangePasswordForm({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmation) return setError("The passwords do not match.");

    setStatus("submitting");
    try {
      await apiSend("POST", "/me/password", {
        password,
        password_confirmation: confirmation,
      });
      setStatus("done");
      // A beat to actually read the confirmation before the page navigates
      // out from under it — signing out is what makes the new password the
      // one that has to be typed next, not a formality.
      setTimeout(() => {
        void signOut();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the password.");
      setStatus("idle");
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="relative w-full max-w-md rounded-md border border-line bg-card shadow-[0_24px_70px_rgba(0,0,0,0.7)]">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-primary/10 blur-[90px] pointer-events-none" />

        <div className="relative px-8 pt-12 pb-9">
          <div className="flex flex-col items-center">
            <Logo size={56} className="w-14 h-14 drop-shadow-[0_0_14px_rgba(220,38,38,0.35)]" />
            <h1 className="mt-5 text-center font-display font-bold tracking-widest text-lg text-foreground">
              SET A NEW <span className="text-primary">PASSWORD</span>
            </h1>
            <p className="mt-2.5 text-center text-xs text-muted-foreground">
              {email} is still on its first-login password.
              <br />
              Choose your own before continuing.
            </p>
          </div>

          {status === "done" ? (
            <div
              role="status"
              className="mt-7 flex items-center gap-2.5 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-foreground"
            >
              <CheckCircle2 size={16} className="shrink-0 text-green-400" />
              <span>Password updated — signing you out…</span>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-7">
              <label
                htmlFor="new-password"
                className="block mb-2 text-xs font-head font-semibold uppercase tracking-widest text-secondary-foreground"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                  className={`${fieldBase} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid place-items-center w-12 text-muted-foreground hover:text-primary-glow transition-colors"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">At least 8 characters.</p>

              <label
                htmlFor="confirm-password"
                className="block mt-5 mb-2 text-xs font-head font-semibold uppercase tracking-widest text-secondary-foreground"
              >
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type={show ? "text" : "password"}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
                required
                className={fieldBase}
              />

              {error && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2.5 rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-primary-glow" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-md bg-primary py-4 font-head font-semibold uppercase tracking-widest text-sm text-white shadow-glow hover:bg-accent transition-colors active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-primary"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving…
                  </>
                ) : (
                  "Update password"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
