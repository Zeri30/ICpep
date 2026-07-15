"use client";

import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import PresentationInner from "@/components/ui/PresentationInner";
import FileDropField, { type FileDropValue } from "@/components/ui/FileDropField";
import { SECTIONS, YEAR_LEVELS } from "@/lib/data";
import { API_URL } from "@/lib/config";

type FormStatus = "idle" | "submitting" | "success" | "error";

/* Shared field styling */
const fieldBase =
  "w-full rounded-md bg-secondary/60 border border-line px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/40";

function Label({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block mb-2 text-xs font-head font-semibold uppercase tracking-widest text-secondary-foreground"
    >
      {children}
      {optional ? (
        <span className="ml-1.5 text-muted-foreground normal-case tracking-normal">(optional)</span>
      ) : (
        <span className="ml-1 text-primary">*</span>
      )}
    </label>
  );
}

/* Shown after a successful submission. */
function SuccessPanel({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-2xl bg-card border border-primary/30 p-8 sm:p-12 text-center shadow-[0_0_40px_rgba(0,0,0,0.4)]">
      <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-primary/15 text-primary-glow mb-5 shadow-glow-sm">
        <CheckCircle2 size={32} />
      </div>
      <h3 className="font-display font-bold text-2xl uppercase tracking-wide">Application Received</h3>
      <p className="mt-3 text-secondary-foreground leading-relaxed max-w-md mx-auto">
        Thank you for applying to ICpEP.SE BulSU Meneses Campus. Our officers will review your application
        and reach out with the next steps.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-7 inline-flex items-center gap-2 rounded-md border border-line px-5 py-3 text-xs font-head font-semibold uppercase tracking-widest text-secondary-foreground hover:text-foreground hover:border-primary/50 transition-colors"
      >
        Submit another application
      </button>
    </div>
  );
}

export default function Membership() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [signatureFile, setSignatureFile] = useState<FileDropValue>(null);
  const [pictureFile, setPictureFile] = useState<FileDropValue>(null);

  const resetForm = () => {
    setStatus("idle");
    setSignatureFile(null);
    setPictureFile(null);
    setErrorMsg("");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!signatureFile || !pictureFile) {
      setStatus("error");
      setErrorMsg("Please upload both your e-signature and your formal picture.");
      return;
    }

    // Build the payload before any await so we don't rely on the event later.
    const payload = new FormData(e.currentTarget);
    payload.append("signature", signatureFile);
    payload.append("picture", pictureFile);

    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/api/applications`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: payload,
      });

      if (!res.ok) {
        let msg = "Something went wrong submitting your application. Please try again.";
        try {
          const data = await res.json();
          // Laravel returns { message, errors: { field: [msg, ...] } } on 422.
          if (res.status === 422 && data?.errors) {
            const first = Object.values(data.errors)[0];
            if (Array.isArray(first) && typeof first[0] === "string") msg = first[0];
          } else if (typeof data?.message === "string" && data.message) {
            msg = data.message;
          }
        } catch {
          /* non-JSON error response — keep the generic message */
        }
        setStatus("error");
        setErrorMsg(msg);
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Couldn't reach the server. Please check your connection and try again.");
    }
  };

  return (
    <section id="membership" className="relative bg-[#070707] border-t border-line/60">
      {/* ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] max-w-full rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <PresentationInner className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <div className="text-center">
          <SectionHeading kicker="Join Us" title="Membership" />
        </div>
        <Reveal className="-mt-8 mb-10 text-center">
          <p className="max-w-xl mx-auto text-secondary-foreground leading-relaxed">
            Become part of ICPEP BulSU Meneses Campus — where Computer Engineering students build, compete, and
            grow together. Fill out the application below and our officers will reach out with your next steps.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          {status === "success" ? (
          <SuccessPanel onReset={resetForm} />
          ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-card border border-line p-6 sm:p-9 shadow-[0_0_40px_rgba(0,0,0,0.4)]"
          >
            <div className="grid sm:grid-cols-2 gap-5">
              {/* Surname */}
              <div>
                <Label htmlFor="surname">Surname</Label>
                <input id="surname" name="surname" type="text" required placeholder="Dela Cruz" className={fieldBase} />
              </div>
              {/* Given name */}
              <div>
                <Label htmlFor="givenName">Given Name</Label>
                <input id="givenName" name="givenName" type="text" required placeholder="Juan" className={fieldBase} />
              </div>

              {/* Middle initial */}
              <div>
                <Label htmlFor="middleInitial" optional>
                  Middle Initial
                </Label>
                <input
                  id="middleInitial"
                  name="middleInitial"
                  type="text"
                  maxLength={1}
                  placeholder="S"
                  className={fieldBase}
                />
              </div>
              {/* Year level */}
              <div>
                <Label htmlFor="yearLevel">Year Level</Label>
                <div className="relative">
                  <select id="yearLevel" name="yearLevel" required defaultValue="" className={`${fieldBase} appearance-none pr-10`}>
                    <option value="" disabled>
                      Select year level
                    </option>
                    {YEAR_LEVELS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              {/* Section */}
              <div>
                <Label htmlFor="section">Section</Label>
                <div className="relative">
                  <select id="section" name="section" required defaultValue="" className={`${fieldBase} appearance-none pr-10`}>
                    <option value="" disabled>
                      Select section
                    </option>
                    {SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              {/* Birthday */}
              <div>
                <Label htmlFor="birthday">Birthday</Label>
                <input id="birthday" name="birthday" type="date" required className={fieldBase} />
              </div>

              {/* Address (full width) */}
              <div className="sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <textarea
                  id="address"
                  name="address"
                  required
                  rows={3}
                  placeholder="House No., Street, Barangay, City/Municipality, Province"
                  className={`${fieldBase} resize-none`}
                />
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email">Email</Label>
                <input id="email" name="email" type="email" required placeholder="juan@example.com" className={fieldBase} />
              </div>
              {/* Phone */}
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <input id="phone" name="phone" type="tel" required placeholder="0912 345 6789" className={fieldBase} />
              </div>

              {/* E-signature — file upload (full width) */}
              <div className="sm:col-span-2">
                <FileDropField
                  label="E-Signature"
                  file={signatureFile}
                  onFileChange={setSignatureFile}
                  required
                  hint="Upload a clear photo or scan of your handwritten signature (or a signed PDF)."
                />
              </div>

              {/* Formal picture — file upload (full width) */}
              <div className="sm:col-span-2">
                <FileDropField
                  label="Formal Picture"
                  file={pictureFile}
                  onFileChange={setPictureFile}
                  required
                  hint="A recent formal photo with a white background."
                />
              </div>
            </div>

            {/* Error banner */}
            {status === "error" && (
              <div className="mt-6 flex items-start gap-2.5 rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
                <AlertCircle size={16} className="text-primary-glow shrink-0 mt-0.5" />
                <span className="text-foreground/90">{errorMsg}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status === "submitting"}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-md bg-primary py-4 font-head font-semibold uppercase tracking-widest text-sm text-white shadow-glow hover:bg-accent transition-colors active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-primary"
            >
              {status === "submitting" ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <Send size={16} /> Submit Application
                </>
              )}
            </button>
          </form>
          )}
        </Reveal>
      </PresentationInner>
    </section>
  );
}
