"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface GsapWordsProps {
  text: string;
  className?: string;
  /** Words matching these (lowercased, punctuation-stripped) get the accent color. */
  accentWords?: string[];
  as?: "p" | "h2" | "h3";
}

/**
 * Editorial word-by-word reveal. Each word starts dim and low, then brightens
 * and rises as the block scrubs through the viewport — the scroll position *is*
 * the timeline, so it reads as a deliberate statement rather than a fade-in.
 */
export default function GsapWords({
  text,
  className = "",
  accentWords = [],
  as = "p",
}: GsapWordsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const accent = new Set(accentWords.map((w) => w.toLowerCase()));
  const words = text.split(" ");

  useGSAP(
    () => {
      const nodes = ref.current?.querySelectorAll<HTMLElement>("[data-word]");
      if (!nodes || nodes.length === 0) return;

      gsap.fromTo(
        nodes,
        { opacity: 0.14, yPercent: 20 },
        {
          opacity: 1,
          yPercent: 0,
          ease: "none",
          stagger: 0.35,
          scrollTrigger: {
            trigger: ref.current,
            start: "top 82%",
            end: "bottom 55%",
            scrub: true,
          },
        }
      );
    },
    { scope: ref }
  );

  const Tag = as;

  return (
    <Tag ref={ref as never} className={className}>
      {words.map((word, i) => {
        const clean = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
        const isAccent = accent.has(clean);
        return (
          <span
            key={i}
            className="inline-block overflow-hidden align-bottom mr-[0.28em]"
          >
            <span
              data-word
              className={
                "inline-block will-change-transform" +
                (isAccent ? " text-primary text-glow-red" : "")
              }
            >
              {word}
            </span>
          </span>
        );
      })}
    </Tag>
  );
}
