"use client";

import { AlertCircle, CheckCircle2, ChevronDown, FolderUp, Loader2, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import PresentationInner from "@/components/ui/PresentationInner";
import { SECTIONS, YEAR_LEVELS } from "@/lib/data";

/* Shared Google Drive folder where applicants upload their formal picture.
   In Drive: right-click the folder → Share → set "Anyone with the link" so
   students can add their photo, then paste the folder's share link here. */
const DRIVE_UPLOAD_URL =
  "https://drive.google.com/drive/folders/1zLX-jrsESSQC55MoeSO6CQ-qGQULIx0E?usp=sharing";
const DRIVE_READY = DRIVE_UPLOAD_URL.startsWith("http");

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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Formspree has been disconnected; online submissions are paused until a
    // new backend is wired up.
    setStatus("error");
    setErrorMsg("Online applications are temporarily unavailable. Please check back soon.");
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
          <SuccessPanel onReset={() => setStatus("idle")} />
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

              {/* E-signature (full width) */}
              <div className="sm:col-span-2">
                <Label htmlFor="signature">E-Signature</Label>
                <input id="signature" name="signature" type="text" required placeholder="Type your full name" className={fieldBase} />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Typing your full name serves as your electronic signature.
                </p>
              </div>

              {/* Formal picture — upload to shared Drive folder (full width) */}
              <div className="sm:col-span-2">
                <Label htmlFor="pictureUploaded">Formal Picture</Label>
                <div className="rounded-md border border-line bg-secondary/40 p-4">
                  <p className="text-sm text-secondary-foreground leading-relaxed">
                    Upload your formal picture (white background) to our shared Google Drive folder.
                    Please name your file with your full name — e.g.{" "}
                    <span className="text-foreground">DelaCruz_Juan.jpg</span>.
                  </p>
                  <a
                    href={DRIVE_READY ? DRIVE_UPLOAD_URL : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!DRIVE_READY}
                    className={`mt-3 inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-xs font-head font-semibold uppercase tracking-widest transition-colors ${
                      DRIVE_READY
                        ? "border-primary/40 bg-primary/10 text-primary-glow hover:bg-primary/20"
                        : "border-line bg-secondary/60 text-muted-foreground pointer-events-none"
                    }`}
                  >
                    <FolderUp size={15} /> Open Drive Folder
                  </a>
                  {!DRIVE_READY && (
                    <p className="mt-2 text-xs text-muted-foreground">Drive folder link coming soon.</p>
                  )}
                  <label
                    htmlFor="pictureUploaded"
                    className="mt-4 flex items-start gap-2.5 text-sm text-secondary-foreground cursor-pointer normal-case tracking-normal font-sans"
                  >
                    <input
                      id="pictureUploaded"
                      name="pictureUploaded"
                      type="checkbox"
                      required
                      value="Yes"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span>I confirm I have uploaded my formal picture to the Drive folder above.</span>
                  </label>
                </div>
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
