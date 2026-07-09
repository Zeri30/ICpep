"use client";

import { motion } from "motion/react";
import { Quote } from "lucide-react";
import SectionHeading from "@/components/ui/SectionHeading";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import { OFFICERS, type Officer } from "@/lib/data";

/* Featured adviser — wide, horizontal, amber-accented */
function AdviserCard({ o }: { o: Officer }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: easeOutExpo }}
      className="group relative overflow-hidden rounded-3xl border border-line bg-card"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-amber-accent/10 via-card to-card" />
      <div className="absolute inset-0 pat-grid opacity-30" />
      <div className="relative grid sm:grid-cols-[auto_1fr] gap-7 md:gap-10 p-7 md:p-10 items-center">
        {/* Big monogram */}
        <div className="relative mx-auto sm:mx-0">
          <div className="absolute -inset-3 rounded-3xl bg-amber-accent/10 blur-xl" />
          <div className="relative grid place-items-center w-32 h-32 md:w-40 md:h-40 rounded-3xl border border-amber-accent/30 bg-gradient-to-br from-amber-accent/25 to-card font-display font-black text-5xl md:text-6xl text-amber-accent">
            {o.initials}
          </div>
        </div>
        {/* Text */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-accent/30 bg-amber-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-accent">
            {o.role}
          </span>
          <h3 className="mt-4 font-display font-bold text-2xl md:text-4xl uppercase tracking-wide leading-tight">
            {o.name}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground tracking-wide">{o.detail}</p>
          <div className="mt-5 flex items-start gap-3 max-w-lg">
            <Quote size={18} className="text-amber-accent/60 shrink-0 mt-1" />
            <p className="text-secondary-foreground leading-relaxed italic">
              Guiding the chapter&apos;s vision and mentoring the next generation of Filipino computer engineers.
            </p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* Officer — large portrait card with monogram "headshot" placeholder */
function OfficerCard({ o, i }: { o: Officer; i: number }) {
  const angle = 120 + i * 35; // vary the gradient direction per card
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay: (i % 3) * 0.08, duration: 0.55, ease: easeOutExpo }}
      whileHover={{ y: -8, boxShadow: "0 0 30px rgba(220,38,38,0.28)" }}
      className="group relative overflow-hidden rounded-2xl border border-line bg-card hover:border-primary/40 transition-colors"
    >
      {/* Portrait / monogram area */}
      <div
        className="relative aspect-[4/5] overflow-hidden"
        style={{ background: `linear-gradient(${angle}deg, rgba(220,38,38,0.22), #0a0a0a 72%)` }}
      >
        <div className="absolute inset-0 pat-dots opacity-50" />
        {/* index */}
        <span className="absolute top-4 left-5 font-display font-bold text-sm text-white/25">
          {String(i + 1).padStart(2, "0")}
        </span>
        {/* big initials */}
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display font-black text-7xl md:text-8xl text-primary-glow/90 group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_25px_rgba(220,38,38,0.35)]">
            {o.initials}
          </span>
        </div>
        {/* role pill anchored to bottom */}
        <span className="absolute bottom-4 left-5 rounded-full border border-primary/30 bg-background/70 backdrop-blur px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-glow">
          {o.role}
        </span>
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-card to-transparent" />
      </div>
      {/* Name plate */}
      <div className="p-6 border-t border-line">
        <h4 className="font-head font-bold text-xl text-foreground leading-tight">{o.name}</h4>
        <p className="mt-1.5 text-xs text-muted-foreground tracking-wide">{o.detail}</p>
      </div>
    </motion.article>
  );
}

export default function Board() {
  const adviser = OFFICERS.find((o) => o.featured);
  const officers = OFFICERS.filter((o) => !o.featured);

  return (
    <section id="board" className="relative bg-[#070707] border-t border-line/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <SectionHeading
          kicker="Leadership"
          title="Executive Board"
          sub="The officers who steer ICPEP BulSU Meneses Campus — students and faculty who lead by building, organizing, and showing up for every member."
        />

        {adviser && (
          <div className="mb-8">
            <AdviserCard o={adviser} />
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {officers.map((o, i) => (
            <OfficerCard key={o.name} o={o} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
