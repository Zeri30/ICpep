"use client";

import { motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Crown, MousePointer2, User, Users } from "lucide-react";
import { useRef, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import { TEAMS, type Team, type TeamMember } from "@/lib/data";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Cap how many member cards each team shows. */
const MEMBERS_PER_TEAM = 4;

/* Small label with an accent tick — separates "Team Head" from "Members". */
function GroupLabel({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="h-px w-6 rounded-full" style={{ background: accent }} />
      <span className="font-head font-semibold uppercase tracking-[0.28em] text-xs text-secondary-foreground">
        {children}
      </span>
    </div>
  );
}

/* Prominent leadership card. */
function HeadCard({ team }: { team: Team }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: easeOutExpo }}
      className="group relative flex items-center gap-5 rounded-2xl border bg-card p-5 sm:p-6 overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
      style={{ borderColor: `${team.accent}40` }}
    >
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{ background: `linear-gradient(120deg, ${team.accent}12, transparent 55%)` }}
      />
      <div className="relative">
        <div
          className="absolute -inset-2 rounded-full blur-lg opacity-70"
          style={{ background: `${team.accent}22` }}
        />
        <Avatar name={team.head} photo={team.headPhoto} accent={team.accent} size={88} className="relative" />
      </div>
      <div className="relative min-w-0">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: team.accent, borderColor: `${team.accent}55`, background: `${team.accent}14` }}
        >
          <Crown size={11} /> Team Head
        </span>
        <h4 className="mt-2.5 font-head font-bold text-lg sm:text-xl text-foreground leading-tight break-words">
          {team.head}
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">{team.headYear}</p>
      </div>
    </motion.div>
  );
}

/* Uniform member profile card: photo, full name, year. */
function MemberCard({ member, accent, index }: { member: TeamMember; accent: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, delay: (index % 5) * 0.05, ease: easeOutExpo }}
      whileHover={{ y: -6, boxShadow: `0 12px 30px -8px ${accent}55` }}
      className="group flex flex-col items-center text-center rounded-2xl border border-line bg-card px-3 py-6 shadow-[0_2px_12px_rgba(0,0,0,0.35)] transition-colors duration-300 hover:border-(--acc)"
      style={{ ["--acc" as string]: `${accent}66` }}
    >
      <span className="rounded-full transition-all duration-300 group-hover:drop-shadow-[0_0_12px_var(--acc)]">
        <Avatar
          name={member.name}
          photo={member.photo}
          accent={accent}
          size={68}
          className="transition-transform duration-300 group-hover:scale-105"
        />
      </span>
      <h5 className="mt-3.5 font-head font-semibold text-sm text-foreground leading-snug">
        {member.name}
      </h5>
      <p className="mt-1 text-xs text-muted-foreground">{member.year}</p>
    </motion.div>
  );
}

/* Compact member chip used inside the pinned showcase (fits a single viewport). */
function MemberChip({ member, accent }: { member: TeamMember; accent: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5">
      <Avatar name={member.name} photo={member.photo} accent={accent} size={44} className="shrink-0" />
      <div className="min-w-0">
        <p className="font-head font-semibold text-sm text-foreground leading-tight truncate">{member.name}</p>
        <p className="text-xs text-muted-foreground">{member.year}</p>
      </div>
    </div>
  );
}

/* Responsibilities + skills, shared by the stacked block and the showcase panel. */
function RespSkills({ team }: { team: Team }) {
  return (
    <div className="grid sm:grid-cols-2 gap-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-head font-semibold mb-3">
          Responsibilities
        </p>
        <ul className="space-y-2">
          {team.resp.map((r) => (
            <li key={r} className="flex items-center gap-2.5 text-sm text-secondary-foreground">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: team.accent }} />
              {r}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-head font-semibold mb-3">
          Skills Required
        </p>
        <div className="flex flex-wrap gap-2">
          {team.skills.map((s) => (
            <span
              key={s}
              className="rounded-md bg-secondary border border-line px-2.5 py-1.5 text-xs text-secondary-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Mobile / tablet: one complete team stacked vertically.
──────────────────────────────────────────────────────────────────────── */
function TeamBlock({ team, index }: { team: Team; index: number }) {
  const members = team.roster.slice(0, MEMBERS_PER_TEAM);
  return (
    <div className="border-t border-line/60 pt-14 first:border-t-0 first:pt-0">
      <Reveal className="flex items-start gap-4 md:gap-5">
        <span
          className="grid place-items-center w-14 h-14 md:w-16 md:h-16 rounded-2xl border border-line shrink-0"
          style={{ color: team.accent, background: `${team.accent}16`, boxShadow: `0 0 24px ${team.accent}22` }}
        >
          <team.icon size={28} />
        </span>
        <div className="min-w-0">
          <span className="font-display font-bold text-sm text-muted-foreground/50 tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="font-display font-bold text-2xl md:text-3xl uppercase tracking-wide leading-none">
            {team.name}
          </h3>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge tone="dark">
              <Users size={11} /> {MEMBERS_PER_TEAM} Members
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-xs text-secondary-foreground">
              <User size={12} style={{ color: team.accent }} /> Head: {team.head}
            </span>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <p className="mt-6 text-secondary-foreground leading-relaxed md:text-lg max-w-3xl">{team.desc}</p>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-7 max-w-3xl">
          <RespSkills team={team} />
        </div>
      </Reveal>

      <div className="mt-10 grid lg:grid-cols-[minmax(0,320px)_1fr] gap-8 lg:gap-10">
        <div>
          <GroupLabel accent={team.accent}>Team Head</GroupLabel>
          <HeadCard team={team} />
        </div>
        <div>
          <GroupLabel accent={team.accent}>Members</GroupLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {members.map((m, i) => (
              <MemberCard key={m.name} member={m} accent={team.accent} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Soft accent glow centred on the stage — keeps each team's panel from
   reading as flat black and carries that team's colour behind its content. */
function TeamBloom({ accent }: { accent: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      <div
        className="w-2xl aspect-square rounded-full"
        style={{
          background: `radial-gradient(circle, ${accent}2b 0%, ${accent}0f 38%, transparent 68%)`,
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Desktop: pinned, sequential showcase — one team at a time, cross-faded by
   scroll (scrub). Mirrors the GSAP pin pattern used by the Events reel.
──────────────────────────────────────────────────────────────────────── */
function ShowcasePanel({ team, index }: { team: Team; index: number }) {
  const members = team.roster.slice(0, MEMBERS_PER_TEAM);
  return (
    // `relative` so the panel paints above the bloom behind it — both are
    // auto z-index, so the later positioned sibling wins.
    <div className="relative mx-auto w-full max-w-6xl px-10 xl:px-16 grid grid-cols-[1fr_minmax(0,360px)] gap-16 xl:gap-24 items-center">
        {/* Identity */}
        <div className="min-w-0">
          <div className="flex items-center gap-4">
            <span
              className="grid place-items-center w-14 h-14 rounded-2xl border border-line shrink-0"
              style={{ color: team.accent, background: `${team.accent}16`, boxShadow: `0 0 28px ${team.accent}26` }}
            >
              <team.icon size={26} />
            </span>
            <span className="font-head font-semibold uppercase tracking-[0.3em] text-xs text-muted-foreground">
              Team {String(index + 1).padStart(2, "0")}
            </span>
          </div>
          <h3 className="mt-7 font-display font-black text-4xl xl:text-5xl uppercase tracking-wide leading-[0.95]">
            {team.name}
          </h3>
          <span className="mt-5 block h-1 w-14 rounded-full" style={{ background: team.accent }} />
          <p className="mt-7 text-secondary-foreground leading-relaxed text-lg max-w-lg">{team.desc}</p>
          <div className="mt-8 flex flex-wrap gap-2 max-w-lg">
            {team.resp.map((r) => (
              <span
                key={r}
                className="rounded-full border px-3 py-1.5 text-xs text-secondary-foreground"
                style={{ borderColor: `${team.accent}33`, background: `${team.accent}0d` }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        {/* People */}
        <div>
          <HeadCard team={team} />
          <div className="mt-8">
            <GroupLabel accent={team.accent}>The Members</GroupLabel>
            <div className="flex flex-col gap-2.5">
              {members.map((m) => (
                <MemberChip key={m.name} member={m} accent={team.accent} />
              ))}
            </div>
          </div>
        </div>
    </div>
  );
}

function TeamsShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement[]>([]);
  const [active, setActive] = useState(0);
  const activeAccent = TEAMS[active]?.accent ?? "#dc2626";

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const panels = panelsRef.current.filter(Boolean);
        if (panels.length === 0) return;

        gsap.set(panels, { autoAlpha: 0, yPercent: 8 });
        gsap.set(panels[0], { autoAlpha: 1, yPercent: 0 });

        const steps = panels.length - 1;
        let index = 0;
        let anim: gsap.core.Timeline | null = null;

        // Fixed-duration transition, decoupled from scroll velocity — the fade
        // never lags behind the scroll or Lenis momentum, so it reads as instant.
        const go = (target: number) => {
          if (target === index) return;
          const dir = target > index ? 1 : -1;
          const from = index;
          index = target;
          setActive(target);

          anim?.kill();
          // Killing mid-flight freezes panels wherever they were, so any panel
          // that isn't part of this transition must be forced hidden — otherwise
          // one stranded at partial autoAlpha keeps painting over the stack.
          panels.forEach((p, i) => {
            if (i !== from && i !== target) gsap.set(p, { autoAlpha: 0 });
          });
          // Only drop the incoming panel to its offset start if it's fully
          // hidden; mid-fade it's already on screen and a reset would flash.
          if (gsap.getProperty(panels[target], "opacity") === 0) {
            gsap.set(panels[target], { yPercent: 8 * dir });
          }

          anim = gsap
            .timeline()
            .to(panels[from], { autoAlpha: 0, yPercent: -8 * dir, duration: 0.45, ease: "power3.inOut" }, 0)
            .to(panels[target], { autoAlpha: 1, yPercent: 0, duration: 0.45, ease: "power3.inOut" }, 0);
        };

        const st = ScrollTrigger.create({
          trigger: sectionRef.current,
          start: "top top",
          // Short per-team distance so a single scroll flicks to the next team.
          end: () => "+=" + window.innerHeight * steps * 0.6,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          // Snap locks onto exactly one team per scroll (no half-faded state).
          snap: {
            snapTo: 1 / steps,
            duration: { min: 0.15, max: 0.3 },
            ease: "power2.inOut",
          },
          onUpdate: (self) => {
            const target = Math.max(0, Math.min(steps, Math.round(self.progress * steps)));
            go(target);
          },
        });

        return () => {
          st.kill();
          anim?.kill();
        };
      });
    },
    { scope: sectionRef }
  );

  return (
    <div ref={sectionRef} className="hidden lg:block relative h-screen overflow-hidden">
      {/* Panels — GSAP owns their inline opacity/visibility once mounted; the
          Tailwind classes only set the pre-hydration state (inline styles win,
          so React re-renders can't clobber the animation). */}
      {TEAMS.map((team, i) => (
        <div
          key={team.name}
          ref={(el) => {
            if (el) panelsRef.current[i] = el;
          }}
          className={`absolute inset-0 flex items-center ${
            i === 0 ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
        >
          <TeamBloom accent={team.accent} />
          <ShowcasePanel team={team} index={i} />
        </div>
      ))}

      {/* Left progress rail — only where the centered content leaves margin room */}
      <div className="hidden xl:flex absolute left-10 top-1/2 -translate-y-1/2 z-10 flex-col gap-4">
        {TEAMS.map((team, i) => {
          const on = i === active;
          return (
            <div key={team.name} className="flex items-center gap-3">
              <span
                className="h-px rounded-full transition-all duration-500"
                style={{
                  width: on ? 28 : 14,
                  background: on ? team.accent : "#3a3a3a",
                }}
              />
              <span
                className="font-head font-semibold uppercase tracking-[0.2em] text-[11px] transition-all duration-500"
                style={{ color: on ? team.accent : "#5a5a5a", opacity: on ? 1 : 0.7 }}
              >
                {team.name.replace(/ Team$/, "")}
              </span>
            </div>
          );
        })}
      </div>

      {/* Section title — kept in the margin so it never crowds the panel */}
      <div className="hidden xl:block absolute top-24 left-10 z-10">
        <p className="font-head font-semibold tracking-[0.35em] uppercase text-primary text-xs">Our Teams</p>
      </div>

      {/* Bottom-right counter + hint */}
      <div className="absolute bottom-10 right-10 xl:right-16 z-10 flex items-center gap-5">
        <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-head">
          <MousePointer2 size={14} className="text-primary/70" /> Scroll to explore
        </span>
        <span className="font-display font-bold tabular-nums text-sm">
          <span style={{ color: activeAccent }}>{String(active + 1).padStart(2, "0")}</span>
          <span className="text-muted-foreground/50"> / {String(TEAMS.length).padStart(2, "0")}</span>
        </span>
      </div>
    </div>
  );
}

export default function Teams() {
  return (
    <section id="teams" className="relative bg-background border-t border-line/60">
      {/* Mobile / tablet: stacked */}
      <div className="lg:hidden mx-auto max-w-7xl px-4 sm:px-6 py-20 md:py-28">
        <SectionHeading
          kicker="Departments"
          title="Our Teams"
          sub="Six specialized units, one organization. Explore what each team does and meet the students who make it run."
        />
        <div className="space-y-14 md:space-y-20">
          {TEAMS.map((t, i) => (
            <TeamBlock key={t.name} team={t} index={i} />
          ))}
        </div>
      </div>

      {/* Desktop: pinned sequential showcase */}
      <TeamsShowcase />
    </section>
  );
}
