"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import GsapWords from "@/components/ui/GsapWords";
import Marquee from "@/components/ui/Marquee";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const KEYWORDS = [
  "PROGRAMMING",
  "DOCUMENTATION",
  "WRITERS",
  "SOCIAL MEDIA",
  "TECHNICAL",
  "E-SPORTS",
];

const KEYWORDS_2 = [
  "BUILD",
  "COMPETE",
  "LEARN",
  "LEAD",
  "CONNECT",
  "REPEAT",
];

export default function Manifesto() {
  const sectionRef = useRef<HTMLElement>(null);

  // Parallax drift for the oversized outlined word behind the statement.
  useGSAP(
    () => {
      gsap.to("[data-ghost]", {
        yPercent: -22,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="relative bg-background overflow-hidden py-28 md:py-44"
    >
      {/* Oversized outlined ghost word, parallaxed */}
      <span
        data-ghost
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 top-8 md:top-4 font-display font-black uppercase leading-none text-stroke select-none text-[26vw]"
      >
        ICPEP
      </span>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-10">
          <span className="h-px w-12 bg-primary" />
          <span className="font-head font-semibold tracking-[0.4em] uppercase text-primary text-xs">
            The Creed
          </span>
        </div>

        <GsapWords
          as="h2"
          text="We are not a club you sign up for. We are a team you become part of — where every commit, every late-night build, and every win belongs to all of us."
          accentWords={["team", "belongs", "win"]}
          className="font-display font-bold uppercase leading-[1.08] tracking-tight text-2xl sm:text-4xl lg:text-[3.4rem] max-w-5xl"
        />

        <div className="mt-12 flex items-center gap-4 text-secondary-foreground">
          <span className="font-display text-primary text-xl">/</span>
          <p className="max-w-md text-sm md:text-base leading-relaxed">
            Six teams. One identity. This is where BulSU Meneses Campus turns
            Computer Engineering students into engineers.
          </p>
        </div>
      </div>

      {/* Twin marquee bands — opposite directions, slight rotation for edge */}
      <div className="relative mt-20 md:mt-28 -rotate-1">
        <Marquee
          items={KEYWORDS}
          className="border-y border-line py-5 font-display font-bold uppercase tracking-[0.2em] text-2xl md:text-4xl text-secondary-foreground"
        />
      </div>
      <div className="relative -mt-px rotate-1">
        <Marquee
          items={KEYWORDS_2}
          reverse
          separator={<span className="mx-6 text-primary" aria-hidden="true">/</span>}
          className="border-y border-line py-4 font-head font-semibold uppercase tracking-[0.35em] text-sm md:text-lg text-muted-foreground bg-card/40"
        />
      </div>
    </section>
  );
}
