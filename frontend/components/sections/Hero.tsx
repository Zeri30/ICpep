"use client";

import { motion } from "motion/react";
import { ArrowRight, Calendar, ChevronDown, Code2, Cpu, Trophy, Users, Zap } from "lucide-react";
import Badge from "@/components/ui/Badge";
import CtaButton from "@/components/ui/CtaButton";
import CountUp from "@/components/ui/CountUp";
import Reveal from "@/components/ui/Reveal";
import InteractiveHeroBackground from "@/components/InteractiveHeroBackground";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import { STATS } from "@/lib/data";

function StatsBar() {
  return (
    <div className="relative -mt-1 border-y border-line bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal
              key={s.label}
              delay={i * 0.08}
              className={`py-8 md:py-10 text-center ${i !== 0 ? "border-l border-line/60" : ""} ${
                i >= 2 ? "border-t lg:border-t-0 border-line/60" : ""
              }`}
            >
              <p className="font-display font-bold text-3xl md:text-4xl text-primary text-glow-red tabular-nums">
                <CountUp end={s.end} suffix={s.suffix} prefix={s.prefix} grouped={s.grouped} />
              </p>
              <p className="mt-2 font-head uppercase tracking-[0.25em] text-xs text-secondary-foreground">
                {s.label}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntroBlock() {
  return (
    <div className="bg-background border-b border-line/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <Reveal>
          <p className="font-head font-semibold tracking-[0.35em] uppercase text-primary text-xs mb-4">
            Who We Are
          </p>
          <h3 className="font-display font-bold text-2xl md:text-3xl uppercase leading-snug">
            Where Future Computer Engineers <span className="text-primary">Are Forged</span>
          </h3>
          <p className="mt-6 text-secondary-foreground leading-relaxed">
            The Institute of Computer Engineers of the Philippines – BulSU Meneses Campus Student Chapter is
            the official home of Computer Engineering students at Bulacan State University, Meneses Campus.
            We are a community of builders, problem-solvers, and competitors — running workshops,
            competitions, outreach programs, and campus-wide tech events that turn classroom theory into real
            engineering skill.
          </p>
          <p className="mt-4 text-secondary-foreground leading-relaxed">
            Whether you write your first line of code with us or your ten-thousandth, ICPEP is where you level
            up.
          </p>
          <div className="mt-8">
            <CtaButton href="#about" variant="outline" className="!px-6 !py-3">
              Learn More <ChevronDown size={16} />
            </CtaButton>
          </div>
        </Reveal>

        {/* CSS-only graphic composition */}
        <Reveal delay={0.15}>
          <div className="relative aspect-square max-w-md mx-auto w-full">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-secondary via-card to-background border border-line pat-grid" />
            <div className="absolute inset-6 rounded-xl border border-primary/20" />
            <div className="absolute inset-0 grid place-items-center">
              <div className="relative">
                <div className="absolute -inset-10 rounded-full bg-primary/10 blur-2xl" />
                <div className="relative grid place-items-center w-36 h-36 md:w-44 md:h-44 rounded-2xl bg-gradient-to-br from-primary to-primary-dark shadow-glow-lg rotate-3">
                  <Cpu size={72} className="text-white" />
                </div>
              </div>
            </div>
            <div className="absolute top-8 left-8 flex items-center gap-2 rounded-md bg-card/90 border border-line px-3 py-2 text-xs font-head uppercase tracking-widest text-secondary-foreground shadow-lg">
              <Code2 size={14} className="text-primary-glow" /> Build
            </div>
            <div className="absolute bottom-10 right-8 flex items-center gap-2 rounded-md bg-card/90 border border-line px-3 py-2 text-xs font-head uppercase tracking-widest text-secondary-foreground shadow-lg">
              <Trophy size={14} className="text-amber-accent" /> Compete
            </div>
            <div className="absolute bottom-1/3 left-4 flex items-center gap-2 rounded-md bg-card/90 border border-line px-3 py-2 text-xs font-head uppercase tracking-widest text-secondary-foreground shadow-lg">
              <Users size={14} className="text-slate-accent" /> Connect
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <>
      <section id="home" className="relative min-h-screen hero-mesh flex flex-col overflow-hidden">
        <InteractiveHeroBackground />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(5,5,5,0.85)_100%)] pointer-events-none" />

        <div className="relative flex-1 flex items-center justify-center px-4 pt-24 pb-16">
          <div className="text-center max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.5 }}
            >
              <Badge tone="red" className="mb-6">
                <Zap size={12} /> Student Edition
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 0.7, ease: easeOutExpo }}
              className="font-display font-black uppercase leading-[1.05] text-4xl sm:text-6xl lg:text-7xl"
            >
              <span className="text-foreground">ICPEP</span>
              <span className="block mt-3 text-2xl sm:text-4xl lg:text-5xl text-primary text-glow-red tracking-wider">
                BulSU Meneses Campus
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.85, duration: 0.6, ease: easeOutExpo }}
              className="mt-7 text-base sm:text-lg lg:text-xl font-light text-secondary-foreground tracking-wide"
            >
              I can&apos;t, but we can.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.05, duration: 0.6, ease: easeOutExpo }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <CtaButton href="#membership">
                Join Us <ArrowRight size={16} />
              </CtaButton>
              <CtaButton href="#events" variant="outline">
                View Events <Calendar size={16} />
              </CtaButton>
            </motion.div>
          </div>
        </div>

        <motion.a
          href="#about"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.6, duration: 0.6 }}
          className="relative mx-auto mb-8 text-muted-foreground hover:text-primary-glow transition-colors"
          aria-label="Scroll down"
        >
          <ChevronDown size={28} className="chevron-bounce" />
        </motion.a>
      </section>

      <StatsBar />
      <IntroBlock />
    </>
  );
}
