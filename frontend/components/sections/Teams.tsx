"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { User, Users } from "lucide-react";
import { useRef, useState } from "react";
import Badge from "@/components/ui/Badge";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { TEAMS, type Team } from "@/lib/data";

const pad = (n: number) => String(n).padStart(2, "0");

/* ---------------------------------------------------------------------------
   Reduced-motion / fallback: simple stacked cards (no pinning)
--------------------------------------------------------------------------- */
function StaticTeams() {
  return (
    <section id="teams" className="relative bg-background border-t border-line/60">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <SectionHeading
          kicker="Departments"
          title="Our Teams"
          sub="Six specialized units, one organization. Every member finds a team where their skills sharpen and their work matters."
        />
        <div className="space-y-5">
          {TEAMS.map((t) => (
            <Reveal key={t.name}>
              <div className="rounded-2xl bg-card border border-line p-7">
                <div className="flex items-center gap-4 mb-3">
                  <span
                    className="grid place-items-center w-14 h-14 rounded-xl border border-line"
                    style={{ color: t.accent, background: `${t.accent}14` }}
                  >
                    <t.icon size={26} />
                  </span>
                  <div>
                    <h3 className="font-display font-bold text-xl uppercase tracking-wide">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">{t.members} · Head: {t.head}</p>
                  </div>
                </div>
                <p className="text-secondary-foreground leading-relaxed">{t.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   The active team's content — pops in / out as the index changes
--------------------------------------------------------------------------- */
function TeamStageContent({ t }: { t: Team }) {
  return (
    <motion.div
      key={t.name}
      initial={{ opacity: 0, y: 46, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -46, scale: 0.94 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <div className="flex items-center gap-4 mb-5">
        <motion.span
          initial={{ rotate: -12, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="grid place-items-center w-16 h-16 md:w-20 md:h-20 rounded-2xl border border-line shrink-0"
          style={{ color: t.accent, background: `${t.accent}18`, boxShadow: `0 0 30px ${t.accent}33` }}
        >
          <t.icon size={36} />
        </motion.span>
        <div>
          <h3 className="font-display font-bold text-2xl md:text-4xl uppercase tracking-wide leading-none">
            {t.name}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="dark">
              <Users size={11} /> {t.members}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-xs text-secondary-foreground">
              <User size={12} style={{ color: t.accent }} /> Head: {t.head}
            </span>
          </div>
        </div>
      </div>

      <p className="text-secondary-foreground leading-relaxed md:text-lg max-w-2xl">{t.desc}</p>

      <div className="mt-6 grid sm:grid-cols-2 gap-6 max-w-2xl">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-head font-semibold mb-3">
            Responsibilities
          </p>
          <ul className="space-y-2">
            {t.resp.map((r, idx) => (
              <motion.li
                key={r}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + idx * 0.06, duration: 0.35 }}
                className="flex items-center gap-2.5 text-sm text-secondary-foreground"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.accent }} />
                {r}
              </motion.li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-head font-semibold mb-3">
            Skills Required
          </p>
          <div className="flex flex-wrap gap-2">
            {t.skills.map((s, idx) => (
              <motion.span
                key={s}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + idx * 0.07, duration: 0.3 }}
                className="rounded-md bg-secondary border border-line px-2.5 py-1.5 text-xs text-secondary-foreground"
              >
                {s}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
   Pinned scroll scene
--------------------------------------------------------------------------- */
function PinnedTeams() {
  const outerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: outerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = Math.min(TEAMS.length - 1, Math.max(0, Math.floor(v * TEAMS.length)));
    setIndex(next);
  });

  const active = TEAMS[index];

  return (
    <section id="teams" className="relative bg-background border-t border-line/60">
      {/* Tall track that provides the scroll distance for the pin */}
      <div ref={outerRef} style={{ height: `${TEAMS.length * 85}vh` }} className="relative">
        {/* Sticky stage — stays on screen while the track scrolls past */}
        <div className="sticky top-0 h-screen overflow-hidden flex flex-col pt-[72px]">
          {/* Shifting accent glow (crossfades per team) */}
          <AnimatePresence>
            <motion.div
              key={`glow-${active.name}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="pointer-events-none absolute -top-1/4 right-0 w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] rounded-full blur-[120px]"
              style={{ background: `radial-gradient(circle, ${active.accent}22, transparent 70%)` }}
            />
          </AnimatePresence>

          {/* Giant ghost number */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-end pr-4 md:pr-16">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={`num-${active.name}`}
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 0.06, y: 0 }}
                exit={{ opacity: 0, y: -60 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="font-display font-black leading-none select-none text-[38vh]"
                style={{ color: active.accent }}
              >
                {pad(index + 1)}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="relative mx-auto w-full max-w-7xl flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
            {/* Header row */}
            <div className="pt-6 md:pt-8 flex items-end justify-between gap-4">
              <div>
                <p className="font-head font-semibold tracking-[0.35em] uppercase text-primary text-xs md:text-sm mb-2">
                  Departments
                </p>
                <h2 className="font-display font-bold text-2xl md:text-4xl uppercase tracking-wide">
                  Our Teams
                </h2>
              </div>
              <div className="font-display font-bold text-sm md:text-base text-secondary-foreground tabular-nums shrink-0">
                <span style={{ color: active.accent }}>{pad(index + 1)}</span>
                <span className="text-muted-foreground"> / {pad(TEAMS.length)}</span>
              </div>
            </div>

            {/* Mobile progress dots */}
            <div className="mt-6 flex md:hidden items-center gap-2">
              {TEAMS.map((t, i) => (
                <div
                  key={t.name}
                  className="h-1 flex-1 rounded-full overflow-hidden bg-line"
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: i < index ? "100%" : i === index ? "100%" : "0%",
                      background: i <= index ? active.accent : "transparent",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Main stage */}
            <div className="flex-1 grid lg:grid-cols-[220px_1fr] gap-8 items-center py-6">
              {/* Desktop vertical rail */}
              <div className="hidden lg:flex flex-col gap-1 relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-line" />
                <motion.div
                  className="absolute left-[7px] top-2 w-px origin-top"
                  style={{ scaleY: scrollYProgress, background: active.accent, bottom: 8 }}
                />
                {TEAMS.map((t, i) => (
                  <div key={t.name} className="relative flex items-center gap-3 py-2 pl-6">
                    <span
                      className="absolute left-0 w-[15px] h-[15px] rounded-full border-2 transition-colors duration-300"
                      style={{
                        borderColor: i <= index ? active.accent : "#262626",
                        background: i === index ? active.accent : "#0a0a0a",
                        boxShadow: i === index ? `0 0 12px ${active.accent}` : "none",
                      }}
                    />
                    <span
                      className={`font-head text-sm tracking-wide transition-colors duration-300 ${
                        i === index ? "text-foreground font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {t.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Content */}
              <div className="min-h-[46vh] flex items-center">
                <AnimatePresence mode="wait">
                  <TeamStageContent key={active.name} t={active} />
                </AnimatePresence>
              </div>
            </div>

            {/* Scroll hint */}
            <div className="pb-6 flex items-center justify-center gap-2 text-[11px] font-head uppercase tracking-[0.3em] text-muted-foreground">
              <span>Keep scrolling to explore all teams</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Teams() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <StaticTeams />;
  return <PinnedTeams />;
}
