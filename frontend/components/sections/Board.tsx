"use client";

import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { MousePointer2, Quote } from "lucide-react";
import { useRef, useState } from "react";
import SectionHeading from "@/components/ui/SectionHeading";
import { OFFICERS, type Officer } from "@/lib/data";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Elliptical dissolve — the portrait carries no frame, its edges just fade
    out into the page so the figure reads as part of the background. */
const PORTRAIT_MASK =
  "radial-gradient(ellipse 74% 80% at 50% 44%, #000 50%, rgba(0,0,0,0.45) 74%, transparent 100%)";

const accentOf = (o: Officer) => (o.featured ? "#f59e0b" : "#dc2626");

/** Adviser first, then officers in roster order. */
function useRoster() {
  const adviser = OFFICERS.find((o) => o.featured);
  const rest = OFFICERS.filter((o) => !o.featured);
  return adviser ? [adviser, ...rest] : rest;
}

/* ─────────────────────────────────────────────────────────────────────────
   Shared pieces
──────────────────────────────────────────────────────────────────────── */

/** Portrait art — fills its parent frame, which must be `relative`. Kept a
    touch transparent so the figure sits in the page rather than on it. */
function PortraitArt({ o, flip, sizes }: { o: Officer; flip: boolean; sizes: string }) {
  const accent = accentOf(o);

  if (!o.photo) {
    return (
      <div className="absolute inset-0 grid place-items-center">
        <span
          className="font-display font-black text-7xl lg:text-8xl opacity-90 drop-shadow-[0_0_30px_rgba(220,38,38,0.4)]"
          style={{ color: accent }}
        >
          {o.initials}
        </span>
      </div>
    );
  }

  return (
    <>
      <Image
        src={o.photo}
        alt={o.name}
        fill
        sizes={sizes}
        className="object-cover opacity-90"
        style={{ maskImage: PORTRAIT_MASK, WebkitMaskImage: PORTRAIT_MASK }}
      />
      {/* accent wash, angled toward the side the figure sits on */}
      <div
        className="absolute inset-0 mix-blend-overlay opacity-90"
        style={{
          background: `linear-gradient(${flip ? "250deg" : "110deg"}, ${accent}66, transparent 62%)`,
          maskImage: PORTRAIT_MASK,
          WebkitMaskImage: PORTRAIT_MASK,
        }}
      />
    </>
  );
}

/** Accent bloom behind the figure. */
function Bloom({ accent }: { accent: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="w-[76%] aspect-square rounded-full blur-3xl" style={{ background: `${accent}1f` }} />
    </div>
  );
}

/** Oversized outlined index sitting behind the portrait. */
function GhostIndex({ index, flip }: { index: number; flip: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 flex items-center ${flip ? "right-0" : "left-0"}`}
    >
      <span className="font-display font-black leading-none select-none text-stroke text-[7rem] lg:text-[10rem]">
        {String(index).padStart(2, "0")}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Desktop: roster list on the left, one huge portrait stage on the right.
   Nothing is pinned and nothing advances on scroll — the whole board is
   reachable from one screen, and hovering a name swaps the stage.
──────────────────────────────────────────────────────────────────────── */
function BoardRoster() {
  const roster = useRoster();
  const adviserCount = roster.filter((o) => o.featured).length;
  const officerCount = roster.length - adviserCount;

  const [hovered, setHovered] = useState<number | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement[]>([]);
  const animRef = useRef<gsap.core.Timeline | null>(null);

  // Portraits wait dissolved out; the intro copy holds the stage.
  useGSAP(
    () => {
      gsap.set(panelsRef.current.filter(Boolean), { autoAlpha: 0, filter: "blur(14px)", scale: 1.08 });
      gsap.set(introRef.current, { autoAlpha: 1, filter: "blur(0px)", scale: 1 });
    },
    { scope: wrapRef }
  );

  // Swap the stage whenever the hovered name changes. Every layer is given an
  // explicit target on every run, so an interrupted swap can't strand one
  // half-faded on top of another.
  useGSAP(
    () => {
      const layers = [introRef.current, ...panelsRef.current];
      const activeIdx = hovered === null ? 0 : hovered + 1;

      animRef.current?.kill();
      const tl = gsap.timeline();
      layers.forEach((el, i) => {
        if (!el) return;
        const on = i === activeIdx;
        tl.to(
          el,
          {
            autoAlpha: on ? 1 : 0,
            filter: on ? "blur(0px)" : "blur(14px)",
            scale: on ? 1 : 1.08,
            duration: on ? 0.5 : 0.3,
            ease: on ? "power3.out" : "power2.inOut",
          },
          0
        );
      });
      animRef.current = tl;
    },
    { dependencies: [hovered], scope: wrapRef }
  );

  // The stage drifts a little with the cursor — enough to feel live, not enough
  // to read as movement.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const wrap = wrapRef.current;
        if (!wrap || !stackRef.current) return;

        const qx = gsap.quickTo(stackRef.current, "x", { duration: 0.8, ease: "power3" });
        const qy = gsap.quickTo(stackRef.current, "y", { duration: 0.8, ease: "power3" });
        const clamp = gsap.utils.clamp(-1, 1);

        const onMove = (e: MouseEvent) => {
          const r = wrap.getBoundingClientRect();
          qx(clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 16);
          qy(clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * 16);
        };
        const onLeave = () => {
          qx(0);
          qy(0);
        };

        wrap.addEventListener("mousemove", onMove);
        wrap.addEventListener("mouseleave", onLeave);
        return () => {
          wrap.removeEventListener("mousemove", onMove);
          wrap.removeEventListener("mouseleave", onLeave);
        };
      });
    },
    { scope: wrapRef }
  );

  return (
    <div className="hidden lg:block mx-auto max-w-7xl px-8 py-24">
      <SectionHeading kicker="Leadership" title="Executive Board" />

      {/* The heading sits outside the grid so `items-center` balances the stage
          against the list alone, not against the heading stacked above it. */}
      <div
        ref={wrapRef}
        className="grid gap-16 xl:gap-24 lg:grid-cols-[1fr_minmax(0,440px)] items-center"
      >
        {/* ── Roster list ── */}
        <ul onMouseLeave={() => setHovered(null)}>
          {roster.map((o, i) => {
            const on = hovered === i;
            const dim = hovered !== null && !on;
            const accent = accentOf(o);
            return (
              <li key={o.name}>
                <div
                  tabIndex={0}
                  onMouseEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  className={`group relative flex items-baseline gap-5 border-b border-line/40 py-4 outline-none transition-opacity duration-300 ${
                    dim ? "opacity-35" : "opacity-100"
                  }`}
                >
                  <span className="w-6 shrink-0 font-display font-bold text-xs tabular-nums text-muted-foreground/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {/* Outlined at rest, filled with the officer's accent on hover. */}
                  <h3
                    className="text-stroke font-display font-black uppercase tracking-wide text-2xl xl:text-3xl leading-none transition-colors duration-300"
                    style={on ? { color: accent } : undefined}
                  >
                    {o.name}
                  </h3>
                  <span className="ml-auto shrink-0 font-head text-xs uppercase tracking-widest text-muted-foreground">
                    {o.role}
                  </span>
                  {/* accent rule that draws in under the hovered name */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left transition-transform duration-500"
                    style={{ background: accent, transform: on ? "scaleX(1)" : "scaleX(0)" }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {/* ── Portrait stage ── */}
        <div ref={stackRef} className="relative w-full h-[64vh] min-h-105 max-h-155">
          {/* Resting state: what this section is about. */}
          <div ref={introRef} className="absolute inset-0 flex flex-col justify-center">
            <span className="font-head font-semibold tracking-[0.35em] uppercase text-primary text-xs">
              The Board
            </span>
            <p className="mt-5 font-display font-bold text-2xl uppercase leading-[1.15] tracking-wide">
              The people who <span className="text-primary text-glow-red">run the chapter.</span>
            </p>
            <p className="mt-5 text-secondary-foreground leading-relaxed">
              The officers who steer ICPEP BulSU Meneses Campus — students and faculty who lead by
              building, organizing, and showing up for every member.
            </p>
            <span className="mt-6 h-1 w-14 rounded-full bg-linear-to-r from-primary to-primary-glow shadow-glow-sm" />
            <p className="mt-6 font-head text-xs uppercase tracking-widest text-muted-foreground">
              {officerCount} Officers · {adviserCount} Adviser
            </p>
            <span className="mt-8 flex items-center gap-2 font-head text-xs uppercase tracking-widest text-muted-foreground">
              <MousePointer2 size={14} className="text-primary/70" /> Hover a name to meet them
            </span>
          </div>

          {/* One layer per officer, stacked. */}
          {roster.map((o, i) => (
            <div
              key={o.name}
              ref={(el) => {
                if (el) panelsRef.current[i] = el;
              }}
              className="absolute inset-0 opacity-0 invisible"
            >
              <Bloom accent={accentOf(o)} />
              <GhostIndex index={i} flip={false} />
              <div className="relative h-full w-full">
                <PortraitArt o={o} flip={false} sizes="440px" />
              </div>
              {/* Role + detail ride with the portrait, anchored to its base. */}
              <div className="absolute inset-x-0 bottom-0">
                <span
                  className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
                  style={{
                    color: accentOf(o),
                    borderColor: `${accentOf(o)}55`,
                    background: `${accentOf(o)}14`,
                  }}
                >
                  {o.role}
                </span>
                <p className="mt-3 text-sm text-muted-foreground tracking-wide">{o.detail}</p>
                {o.featured && (
                  <div className="mt-3 flex items-start gap-2.5 max-w-sm">
                    <Quote size={16} className="shrink-0 mt-1" style={{ color: `${accentOf(o)}99` }} />
                    <p className="text-sm text-secondary-foreground leading-relaxed italic">
                      Guiding the chapter&apos;s vision and mentoring the next generation of Filipino
                      computer engineers.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Mobile / tablet: no hover to lean on, so the roster is stacked and each
   figure develops out of the background as it scrolls into reading height.
──────────────────────────────────────────────────────────────────────── */
function BoardRows() {
  const roster = useRoster();
  const wrapRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(max-width: 1023px) and (prefers-reduced-motion: no-preference)", () => {
        const rows = gsap.utils.toArray<HTMLElement>("[data-row]", wrapRef.current);

        rows.forEach((row) => {
          const dir = row.dataset.flip === "1" ? -1 : 1;

          gsap.fromTo(
            row.querySelector("[data-media]"),
            { autoAlpha: 0.05, scale: 1.16, xPercent: 9 * dir, filter: "blur(14px)" },
            {
              autoAlpha: 1,
              scale: 1,
              xPercent: 0,
              filter: "blur(0px)",
              ease: "none",
              scrollTrigger: { trigger: row, start: "top 88%", end: "center 60%", scrub: true },
            }
          );
          gsap.fromTo(
            row.querySelector("[data-copy]"),
            { autoAlpha: 0, y: 26 },
            {
              autoAlpha: 1,
              y: 0,
              ease: "none",
              scrollTrigger: { trigger: row, start: "top 80%", end: "center 64%", scrub: true },
            }
          );
        });
      });
    },
    { scope: wrapRef }
  );

  return (
    <div ref={wrapRef} className="lg:hidden mx-auto max-w-7xl px-4 sm:px-6 py-20 md:py-28">
      <SectionHeading
        kicker="Leadership"
        title="Executive Board"
        sub="The officers who steer ICPEP BulSU Meneses Campus — students and faculty who lead by building, organizing, and showing up for every member."
      />
      {roster.map((o, i) => {
        const flip = i % 2 === 1;
        const accent = accentOf(o);
        return (
          <article
            key={o.name}
            data-row
            data-flip={flip ? "1" : "0"}
            className="relative border-t border-line/40 py-14 first:border-t-0"
          >
            <div data-media className="relative mx-auto w-full max-w-95">
              <Bloom accent={accent} />
              <GhostIndex index={i} flip={flip} />
              <div className="relative w-full aspect-4/5">
                <PortraitArt o={o} flip={flip} sizes="80vw" />
              </div>
            </div>

            <div data-copy className="relative mt-8 flex flex-col items-start">
              <span
                className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: accent, borderColor: `${accent}55`, background: `${accent}14` }}
              >
                {o.role}
              </span>
              <h3 className="mt-5 font-display font-black text-3xl uppercase tracking-wide leading-[0.95]">
                {o.name}
              </h3>
              <span className="mt-5 block h-1 w-14 rounded-full" style={{ background: accent }} />
              <p className="mt-5 text-sm text-muted-foreground tracking-wide">{o.detail}</p>
              {o.featured && (
                <div className="mt-6 flex items-start gap-3 max-w-md">
                  <Quote size={18} className="shrink-0 mt-1" style={{ color: `${accent}99` }} />
                  <p className="text-secondary-foreground leading-relaxed italic">
                    Guiding the chapter&apos;s vision and mentoring the next generation of Filipino
                    computer engineers.
                  </p>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function Board() {
  return (
    <section id="board" className="relative bg-[#070707] border-t border-line/60">
      <BoardRows />
      <BoardRoster />
    </section>
  );
}
