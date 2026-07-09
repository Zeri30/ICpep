"use client";

import { ChevronDown, Send } from "lucide-react";
import type { FormEvent } from "react";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import PresentationInner from "@/components/ui/PresentationInner";
import { SECTIONS, YEAR_LEVELS } from "@/lib/data";

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

export default function Membership() {
  // NOTE: Formspree is intentionally NOT wired up yet. The form is UI-only for now.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

              {/* Formal picture (full width) */}
              <div className="sm:col-span-2">
                <Label htmlFor="picture">Formal Picture</Label>
                <input
                  id="picture"
                  name="picture"
                  type="url"
                  required
                  placeholder="Paste your Google Drive link here"
                  className={fieldBase}
                />
              </div>
            </div>

            {/* Submit (UI only — not wired up yet) */}
            <button
              type="submit"
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-md bg-primary py-4 font-head font-semibold uppercase tracking-widest text-sm text-white shadow-glow hover:bg-accent transition-colors active:scale-[0.99]"
            >
              <Send size={16} /> Submit Application
            </button>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Form submission is not yet active — this is a preview of the application form.
            </p>
          </form>
        </Reveal>
      </PresentationInner>
    </section>
  );
}
