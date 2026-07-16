"use client";

import { motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight, ArrowUpRight, Calendar, MapPin, MousePointer2, Play, Zap } from "lucide-react";
import { useRef } from "react";
import Badge from "@/components/ui/Badge";
import CtaButton from "@/components/ui/CtaButton";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { EVENTS, type EventItem } from "@/lib/data";

gsap.registerPlugin(ScrollTrigger, useGSAP);

function FeaturedEvent() {
  return (
    <Reveal>
      <div className="relative rounded-2xl overflow-hidden border border-line bg-card">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/25 via-card to-card pointer-events-none" />
        <div className="absolute inset-0 pat-grid opacity-40 pointer-events-none" />
        <div className="relative grid lg:grid-cols-2 gap-8 p-7 md:p-12">
          <div className="flex flex-col justify-center">
            <Badge tone="red" className="self-start mb-5 pulse-ring">
              <Zap size={12} /> Featured Event
            </Badge>
            <h3 className="font-display font-black text-3xl md:text-4xl uppercase leading-tight">
              ICPEP <span className="text-primary text-glow-red">CPE Week 2025</span>
            </h3>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <Calendar size={16} className="text-primary" /> November 3–7, 2025
              </span>
              <span className="flex items-center gap-2 text-foreground">
                <MapPin size={16} className="text-primary" /> BulSU Meneses Campus
              </span>
            </div>
            <p className="mt-5 text-secondary-foreground leading-relaxed max-w-xl">
              A week-long celebration showcasing the skills, talents, and creativity of Computer
              Engineering students through a lineup of activities and competitions. It closes with CPE
              Night — a themed social celebration exclusively for CPE students, with a fresh theme each
              year — building camaraderie, school spirit, and student engagement.
            </p>
            <div className="mt-7">
              <CtaButton href="#membership">
                Register Now <ArrowRight size={16} />
              </CtaButton>
            </div>
          </div>

          <div className="flex items-center">
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="relative w-full aspect-video rounded-xl overflow-hidden border border-line bg-gradient-to-br from-secondary via-background to-background cursor-pointer group"
            >
              <div className="absolute inset-0 pat-diag opacity-60" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.12),transparent_65%)]" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <span className="mx-auto grid place-items-center w-20 h-20 rounded-full bg-primary text-white shadow-glow-lg group-hover:scale-110 transition-transform duration-300 pulse-ring">
                    <Play size={30} className="ml-1" fill="currentColor" />
                  </span>
                  <p className="mt-5 font-head font-semibold uppercase tracking-[0.3em] text-xs text-secondary-foreground">
                    Promo Video · Coming Soon
                  </p>
                </div>
              </div>
              <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-primary-glow to-primary" />
            </motion.div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

const toneHex: Record<EventItem["tone"], string> = {
  red: "#dc2626",
  amber: "#f59e0b",
  slate: "#64748b",
};

/* One large event "slide" used in the horizontal reel. */
function EventPanel({ e, index }: { e: EventItem; index: number }) {
  const hex = toneHex[e.tone];
  return (
    <article className="group relative shrink-0 w-[78vw] sm:w-[46vw] lg:w-[32vw] xl:w-[25vw] h-[60vh] rounded-2xl border border-line bg-card overflow-hidden flex flex-col p-8">
      <div className="absolute top-0 inset-x-0 h-1" style={{ background: `linear-gradient(90deg, ${hex}, transparent)` }} />
      <span
        className="pointer-events-none absolute -right-2 -top-6 font-display font-black leading-none select-none text-[10rem] opacity-[0.06]"
        style={{ color: hex }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="flex items-center justify-between">
        <Badge tone={e.tone}>{e.cat}</Badge>
        <ArrowUpRight
          size={20}
          className="text-muted-foreground/40 group-hover:text-primary group-hover:-translate-y-1 group-hover:translate-x-1 transition-all"
        />
      </div>

      <div className="mt-auto">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1.5">
            <Calendar size={13} style={{ color: hex }} /> {e.date}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={13} style={{ color: hex }} /> {e.venue}
          </span>
        </div>
        <h4 className="font-display font-bold text-2xl md:text-3xl uppercase tracking-wide leading-tight">
          {e.name}
        </h4>
        <p className="mt-3 text-sm text-secondary-foreground leading-relaxed">{e.desc}</p>
      </div>
    </article>
  );
}

/* Desktop: pinned section, cards travel horizontally as you scroll vertically. */
function HorizontalReel() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        const track = trackRef.current;
        if (!track) return;
        const getAmount = () => Math.max(0, track.scrollWidth - window.innerWidth + 64);

        const tween = gsap.to(track, {
          x: () => -getAmount(),
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: () => "+=" + getAmount(),
            scrub: 1,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });
    },
    { scope: sectionRef }
  );

  return (
    <div ref={sectionRef} className="hidden md:block relative h-screen overflow-hidden">
      {/* pinned header */}
      <div className="absolute top-0 inset-x-0 z-10 pt-[88px]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 flex items-end justify-between">
          <div>
            <p className="font-head font-semibold tracking-[0.35em] uppercase text-primary text-xs mb-2">
              The Calendar
            </p>
            <h3 className="font-display font-bold text-2xl lg:text-3xl uppercase tracking-wide">
              Past &amp; Upcoming
            </h3>
          </div>
          <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-head">
            <MousePointer2 size={14} className="text-primary/70" /> Scroll to travel the year
          </span>
        </div>
      </div>

      <div className="h-full flex items-center">
        <div
          ref={trackRef}
          className="flex items-stretch gap-6 pl-6 lg:pl-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))] pr-[30vw]"
        >
          {EVENTS.map((e, i) => (
            <EventPanel key={e.name} e={e} index={i} />
          ))}
          {/* end cap */}
          <div className="shrink-0 w-[42vw] lg:w-[26vw] h-[60vh] flex flex-col items-start justify-center pl-4">
            <p className="font-display font-bold text-3xl uppercase leading-tight">
              Want in on the <span className="text-primary text-glow-red">next one?</span>
            </p>
            <p className="mt-4 text-secondary-foreground max-w-xs leading-relaxed">
              Members get first access to every workshop, competition, and trip. Your seat is one form away.
            </p>
            <div className="mt-7">
              <CtaButton href="#membership">
                Become a Member <ArrowRight size={16} />
              </CtaButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Mobile: plain horizontal snap scroll (no pin). */
function MobileReel() {
  return (
    <div className="md:hidden">
      <Reveal className="mx-auto max-w-7xl px-4 mt-12 mb-5">
        <h3 className="font-display font-bold text-xl uppercase tracking-wide">Past &amp; Upcoming</h3>
      </Reveal>
      <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar snap-x snap-mandatory px-4">
        {EVENTS.map((e, i) => (
          <div key={e.name} className="snap-start shrink-0 w-[80vw]">
            <EventPanel e={e} index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Events() {
  return (
    <section id="events" className="relative bg-[#070707] border-t border-line/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 md:pt-28 pb-4 md:pb-10">
        <SectionHeading
          kicker="What's Happening"
          title="Events"
          sub="Throughout the academic year, ICPEP hosts seminars, competitions, workshops, and special celebrations that promote learning, engagement, and community within the Computer Engineering program."
        />
        <FeaturedEvent />
      </div>

      <MobileReel />
      <HorizontalReel />
    </section>
  );
}
