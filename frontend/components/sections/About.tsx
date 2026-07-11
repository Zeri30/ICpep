"use client";

import { motion } from "motion/react";
import { ArrowUpRight, Check, Lightbulb, Sparkles, Target, Zap } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import PresentationInner from "@/components/ui/PresentationInner";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import { ACTIVITIES, BENEFITS, OBJECTIVES } from "@/lib/data";

export default function About() {
  return (
    <section id="about" className="relative bg-background">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <PresentationInner className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <SectionHeading
          kicker="About Us"
          title="The Organization"
          sub="ICPEP – BulSU Meneses Campus is the official student organization of the Bachelor of Science in Computer Engineering program at Bulacan State University, Meneses Campus — a proud student chapter under the Institute of Computer Engineers of the Philippines, the national professional organization of computer engineers."
        />

        {/* Mission / Vision — shared hairline frame, vertical spine labels, ghost glyphs */}
        <Reveal className="mb-14">
          <div className="grid md:grid-cols-2 gap-px bg-line rounded-2xl overflow-hidden border border-line">
            {[
              {
                label: "Mission",
                index: "01",
                icon: Zap,
                accent: "text-primary-glow",
                glyph: "text-primary/[0.05]",
                body: "The Institute of Computer Engineers of the Philippines Student Edition (ICpEP.SE) is committed to bridging the gap between the industry and the academe by empowering the interests, welfare, and ideals of its members, developing a strong harmonious foundation within its community, and professionalizing the skills of its officers and members for global competitiveness and national progression.",
              },
              {
                label: "Vision",
                index: "02",
                icon: Lightbulb,
                accent: "text-amber-accent",
                glyph: "text-amber-accent/[0.05]",
                body: "To be the leading student organization of BulSU Meneses Campus — a recognized hub of technical excellence, innovation, and leadership that produces world-class Filipino computer engineers who shape the future of technology.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="group relative bg-card p-8 md:p-10 overflow-hidden flex gap-6 min-h-64"
              >
                {/* Oversized ghost glyph bleeding out of the corner */}
                <item.icon
                  className={`pointer-events-none absolute -bottom-8 -right-6 ${item.glyph} group-hover:scale-110 transition-transform duration-500`}
                  size={190}
                  strokeWidth={1}
                />
                {/* Vertical spine label */}
                <span
                  className={`shrink-0 font-display font-bold uppercase tracking-[0.35em] text-sm ${item.accent} [writing-mode:vertical-rl] rotate-180 self-stretch flex items-center`}
                >
                  {item.label}
                </span>
                <div className="relative flex-1">
                  <div className="flex items-center gap-3 mb-5">
                    <span className={`font-display font-bold text-lg ${item.accent}`}>{item.index}</span>
                    <span className="h-px flex-1 bg-line" />
                    <item.icon size={18} className={item.accent} />
                  </div>
                  <p className="text-lg md:text-xl leading-relaxed text-foreground/90 font-light">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Objectives + What we do */}
        <div className="grid lg:grid-cols-2 gap-6 mb-16">
          <Reveal>
            <div className="h-full rounded-xl bg-card border border-line p-8">
              <h3 className="font-display font-bold text-xl uppercase tracking-wide mb-6 flex items-center gap-3">
                <Target size={22} className="text-primary" /> Objectives
              </h3>
              <ul className="space-y-4">
                {OBJECTIVES.map((o, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ delay: i * 0.07, duration: 0.4 }}
                    className="flex gap-3 text-secondary-foreground leading-relaxed"
                  >
                    <span className="mt-1 grid place-items-center w-5 h-5 shrink-0 rounded-full bg-primary/15 text-primary-glow">
                      <Check size={12} />
                    </span>
                    {o}
                  </motion.li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="h-full rounded-xl bg-card border border-line p-8 flex flex-col">
              <h3 className="font-display font-bold text-xl uppercase tracking-wide mb-6 flex items-center gap-3">
                <Sparkles size={22} className="text-primary" /> What We Do
              </h3>
              <p className="text-secondary-foreground leading-relaxed">
                Throughout the academic year, ICPEP runs technical{" "}
                <span className="text-foreground font-medium">seminars and workshops</span>, organizes{" "}
                <span className="text-foreground font-medium">coding competitions and hackathons</span>, joins
                regional and national <span className="text-foreground font-medium">ICPEP events</span>, leads{" "}
                <span className="text-foreground font-medium">community outreach</span> programs that bring
                technology to local schools, and holds{" "}
                <span className="text-foreground font-medium">team-building activities</span> that turn
                classmates into lifelong colleagues.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {ACTIVITIES.map((a) => (
                  <div
                    key={a.label}
                    className="flex items-center gap-2.5 rounded-lg bg-secondary/60 border border-line px-4 py-3"
                  >
                    <a.icon size={16} className="text-primary-glow shrink-0" />
                    <span className="text-sm font-head font-semibold uppercase tracking-wider text-secondary-foreground">
                      {a.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Benefits — editorial numbered ledger, not a card grid */}
        <div className="grid lg:grid-cols-[minmax(0,22rem)_1fr] gap-10 lg:gap-16 items-start">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <span className="font-display font-black text-6xl md:text-7xl text-stroke-red leading-none">
                06
              </span>
              <h3 className="mt-4 font-display font-bold text-2xl md:text-3xl uppercase tracking-wide leading-tight">
                Why Join <span className="text-primary text-glow-red">ICPEP</span>
              </h3>
              <p className="mt-4 text-secondary-foreground leading-relaxed">
                Membership is more than a name on a list — it is an upgrade path.
                Six reasons students keep showing up.
              </p>
            </div>
          </Reveal>

          <ul className="border-t border-line">
            {BENEFITS.map((b, i) => (
              <motion.li
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: (i % 2) * 0.06, duration: 0.4, ease: easeOutExpo }}
                className="group relative border-b border-line"
              >
                {/* accent line that grows on hover */}
                <span className="absolute left-0 top-0 h-full w-px bg-primary origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-300" />
                <div className="flex items-baseline gap-5 md:gap-8 py-7 pl-4 md:pl-6 transition-[padding] duration-300 group-hover:pl-7 md:group-hover:pl-10">
                  <span className="font-display font-bold text-sm text-muted-foreground group-hover:text-primary transition-colors tabular-nums pt-1">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <b.icon
                        size={22}
                        className="text-muted-foreground group-hover:text-primary-glow transition-colors shrink-0"
                      />
                      <h4 className="font-head font-bold text-xl md:text-2xl uppercase tracking-wide text-foreground">
                        {b.title}
                      </h4>
                    </div>
                    <p className="mt-2 text-sm md:text-base text-secondary-foreground leading-relaxed max-w-xl opacity-80 group-hover:opacity-100 transition-opacity">
                      {b.desc}
                    </p>
                  </div>
                  <ArrowUpRight
                    size={22}
                    className="hidden sm:block text-muted-foreground/40 group-hover:text-primary group-hover:-translate-y-1 group-hover:translate-x-1 transition-all shrink-0 self-center"
                  />
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </PresentationInner>
    </section>
  );
}
