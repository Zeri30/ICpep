"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Logo from "@/components/ui/Logo";
import { easeOutExpo } from "@/components/ui/motion-primitives";

/* Matches the Membership form's fields so the two read as one system. */
const fieldBase =
  "w-full rounded-md bg-secondary/60 border border-line px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/40";

type Status = "idle" | "submitting";

export default function SignInModal({
  open,
  onClose,
  redirectTo,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Where to land after signing in, overriding the backend's own answer (the
   * admin dashboard).
   *
   * Set by the check-in page, which is reached by scanning a QR and must be
   * returned to with its token intact — landing that officer on the dashboard
   * would lose the scan and leave them to find their way back with no URL to
   * type. Left unset everywhere else, where the dashboard is the right place.
   */
  redirectTo?: string;
}) {
  // The dialog owns the form state and only exists while open, so a reopened
  // modal starts clean without any state to reset.
  return (
    <AnimatePresence>
      {open && <SignInDialog onClose={onClose} redirectTo={redirectTo} />}
    </AnimatePresence>
  );
}

function SignInDialog({
  onClose,
  redirectTo,
}: {
  onClose: () => void;
  redirectTo?: string;
}) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    emailRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    const form = new FormData(e.currentTarget);

    try {
      // Laravel validates the POST against the session this call establishes.
      const csrfRes = await fetch("/auth/csrf", { credentials: "same-origin" });
      if (!csrfRes.ok) throw new Error("csrf");
      const { token } = await csrfRes.json();

      const res = await fetch("/auth/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-CSRF-TOKEN": token,
        },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          remember: form.get("remember") === "on",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message ?? "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }

      // Full navigation, not a router push: the admin is served by Laravel
      // through the proxy, not by Next's router. A caller-supplied destination
      // wins over the backend's — see `redirectTo`.
      window.location.href = redirectTo ?? data.redirect ?? "/admin";
    } catch {
      setError("Couldn't reach the server. Is the backend running?");
      setStatus("idle");
    }
  }

  return (
    <>
      <motion.div
        key="signin-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
        className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm"
      />
      <div className="fixed inset-0 z-[100] grid place-items-center p-4 pointer-events-none">
        <motion.div
          key="signin-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signin-modal-title"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.35, ease: easeOutExpo }}
          className="pointer-events-auto relative w-full max-w-md rounded-md border border-line bg-card shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-primary/10 blur-[90px] pointer-events-none" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 grid place-items-center w-10 h-10 rounded-md border border-line text-secondary-foreground hover:border-primary/50 hover:text-primary-glow transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* z-10 above: this content block is `position: relative` too, and
              with both it and the button left at their default z-index:auto,
              CSS stacking breaks the tie by DOM order — this later block
              would paint (and hit-test) above the button despite having no
              visible background there, silently swallowing clicks aimed at
              the X even though it renders looking completely normal. */}
          <div className="relative px-8 pt-12 pb-9">
            <div className="flex flex-col items-center">
              <Logo
                size={56}
                className="w-14 h-14 drop-shadow-[0_0_14px_rgba(220,38,38,0.35)]"
              />
              <h2
                id="signin-modal-title"
                className="mt-5 font-display font-bold tracking-widest text-xl text-foreground"
              >
                SIGN <span className="text-primary">IN</span>
              </h2>
              <p className="mt-2.5 text-center text-xs text-muted-foreground">
                Enter your credentials to continue.
              </p>
            </div>

            <form onSubmit={onSubmit} className="mt-8">
              <label
                htmlFor="signin-email"
                className="block mb-2 text-xs font-head font-semibold uppercase tracking-widest text-secondary-foreground"
              >
                Email
              </label>
              <input
                ref={emailRef}
                id="signin-email"
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="you@example.com"
                className={fieldBase}
              />

              <label
                htmlFor="signin-password"
                className="block mt-5 mb-2 text-xs font-head font-semibold uppercase tracking-widest text-secondary-foreground"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="signin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`${fieldBase} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid place-items-center w-12 text-muted-foreground hover:text-primary-glow transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <label
                htmlFor="signin-remember"
                className="mt-5 flex items-center gap-2.5 text-sm text-secondary-foreground select-none cursor-pointer w-fit"
              >
                <input
                  id="signin-remember"
                  name="remember"
                  type="checkbox"
                  className="h-4 w-4 rounded border-line bg-secondary/60 accent-primary"
                />
                Remember me
              </label>

              {error && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2.5 rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground"
                >
                  <AlertCircle
                    size={16}
                    className="mt-0.5 shrink-0 text-primary-glow"
                  />
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
                    <Loader2 size={16} className="animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    <LogIn size={16} /> Sign In
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </>
  );
}
