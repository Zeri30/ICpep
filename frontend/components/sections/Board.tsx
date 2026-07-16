"use client";

import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Hand } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import SectionHeading from "@/components/ui/SectionHeading";
import { OFFICERS, type Officer } from "@/lib/data";

gsap.registerPlugin(useGSAP);

const accentOf = (o: Officer) => (o.featured ? "#f59e0b" : "#dc2626");

/** Adviser first, then officers in roster order. */
function useRoster() {
  const adviser = OFFICERS.find((o) => o.featured);
  const rest = OFFICERS.filter((o) => !o.featured);
  return adviser ? [adviser, ...rest] : rest;
}

/* ─────────────────────────────────────────────────────────────────────────
   Deck geometry

   Every card's transform is derived from one continuous `pos` value rather
   than from an index, so a drag can sit halfway between two cards and the
   deck still resolves. `delta` returns the *shortest* signed distance around
   the ring, which is what makes the loop seamless — card 0 sits one step to
   the right of card 13 without any cloned slides.
──────────────────────────────────────────────────────────────────────── */

/** Horizontal gap between neighbours, as a fraction of card width. */
const GAP = 0.64;

/* ─────────────────────────────────────────────────────────────────────────
   Card faces
──────────────────────────────────────────────────────────────────────── */

/** Front = the officer's card art, shown whole. The designed photos already
    carry their own name/role/logo, so nothing is drawn over them; only a bare
    studio portrait gets a scrim and a name. */
function CardFront({ o }: { o: Officer }) {
  const accent = accentOf(o);
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-3xl border bg-[#0d0d0d]"
      style={{ backfaceVisibility: "hidden", borderColor: `${accent}40` }}
    >
      {o.photo ? (
        <Image
          src={o.photo}
          alt={o.name}
          fill
          sizes="(max-width: 640px) 60vw, 300px"
          draggable={false}
          /* Eager on purpose: the whole deck is one gesture away, and lazy
             loading would pop portraits in mid-rotation. */
          loading="eager"
          className="select-none object-cover"
          /* Bare portraits are taller than the 4:5 card, so bias the crop up
             and keep the face off the cut line. */
          style={o.plainPortrait ? { objectPosition: "50% 18%" } : undefined}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-6xl font-black" style={{ color: accent }}>
            {o.initials}
          </span>
        </div>
      )}

      {o.plainPortrait && (
        <>
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-black/95 via-black/50 to-transparent"
          />
          <h3 className="absolute inset-x-4 bottom-4 font-display text-lg font-black uppercase leading-[0.95] text-white">
            {o.name}
          </h3>
        </>
      )}
    </div>
  );
}

function CardBack({ o, index }: { o: Officer; index: number }) {
  const accent = accentOf(o);
  return (
    <div
      className="absolute inset-0 grid place-items-center overflow-hidden rounded-3xl border bg-[#0b0b0b] px-6 text-center"
      style={{
        backfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
        borderColor: `${accent}66`,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${accent}2e, transparent 70%)` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 grid select-none place-items-center font-display text-[9rem] font-black leading-none text-stroke opacity-40"
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="relative">
        <p
          className="text-balance font-display text-2xl font-black uppercase leading-[1.05]"
          style={{ color: accent }}
        >
          {o.role}
        </p>
        <span className="mx-auto mt-4 block h-1 w-12 rounded-full" style={{ background: accent }} />
        <p className="mt-4 font-head text-sm uppercase tracking-widest text-white">{o.name}</p>
        <p className="mt-2 text-xs text-muted-foreground">{o.detail}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Board
──────────────────────────────────────────────────────────────────────── */

export default function Board() {
  const roster = useRoster();
  const n = roster.length;

  const stageRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement[]>([]);
  const posRef = useRef(0);
  const cardWRef = useRef(280);
  const activeRef = useRef(0);
  const dragRef = useRef({ on: false, startX: 0, startPos: 0, moved: 0 });
  const detachRef = useRef<(() => void) | null>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const [active, setActive] = useState(0);
  const [flipped, setFlipped] = useState<Set<number>>(() => new Set());

  const wrap = useCallback((i: number) => ((i % n) + n) % n, [n]);

  /** Shortest signed ring distance from `pos` to card `i`. */
  const delta = useCallback(
    (i: number, pos: number) => {
      let d = (((i - pos) % n) + n) % n;
      if (d > n / 2) d -= n;
      return d;
    },
    [n]
  );

  const render = useCallback(() => {
    const pos = posRef.current;
    const cw = cardWRef.current;

    cardsRef.current.forEach((el, i) => {
      if (!el) return;
      const d = delta(i, pos);
      const ad = Math.abs(d);
      const near = ad <= 3.4;

      // Compressed spacing so the far cards tuck in rather than march off.
      const x = Math.sign(d) * Math.pow(ad, 0.86) * cw * GAP;
      const scale = Math.max(0.55, 1 - ad * 0.12);
      const ry = gsap.utils.clamp(-24, 24, -d * 15);
      const tz = -ad * 140;

      el.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), -50%, ${tz.toFixed(
        2
      )}px) rotateY(${ry.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      el.style.opacity = near ? String(Math.max(0, 1 - ad * 0.2)) : "0";
      el.style.zIndex = String(500 - Math.round(ad * 10));
      el.style.visibility = near ? "visible" : "hidden";
      el.style.pointerEvents = ad <= 2.2 ? "auto" : "none";
    });
  }, [delta]);

  const go = useCallback(
    (target: number, duration = 0.75) => {
      tweenRef.current?.kill();

      // Only drop the flips when we actually land on a different officer —
      // otherwise the snap that follows a tap would undo the tap's own flip.
      const next = wrap(Math.round(target));
      if (next !== activeRef.current) {
        setFlipped(new Set());
        activeRef.current = next;
        setActive(next);
      }

      // GSAP tweens its own proxy rather than posRef: posRef is also written by
      // the drag and re-anchored below, and letting both own one value lets a
      // stale tween tick clobber a fresh position.
      const proxy = { v: posRef.current };
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      tweenRef.current = gsap.to(proxy, {
        v: target,
        duration: reduce ? 0 : duration,
        ease: "power3.out",
        onUpdate: () => {
          posRef.current = proxy.v;
          render();
        },
        onComplete: () => {
          // Re-anchor inside [0, n) so many laps can't drift the float. Every
          // transform is derived circularly, so this is invisible.
          posRef.current = wrap(target);
          render();
        },
      });
    },
    [render, wrap]
  );

  const step = useCallback((dir: number) => go(Math.round(posRef.current) + dir), [go]);

  useGSAP(
    () => {
      const measure = () => {
        const el = cardsRef.current[0];
        if (el?.offsetWidth) cardWRef.current = el.offsetWidth;
        render();
      };
      measure();

      const ro = new ResizeObserver(measure);
      const stage = stageRef.current;
      if (stage) ro.observe(stage);

      /* Sideways scroll only — a trackpad swipe or shift+wheel. A plain
         vertical wheel is left alone so the page scrolls past the section
         normally instead of trapping the reader here.

         Bound natively rather than via onWheel because React registers wheel
         listeners as passive at the root, where preventDefault() is a no-op. */
      let snap: ReturnType<typeof setTimeout>;
      const onWheel = (e: WheelEvent) => {
        const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
        if (!dx) return;
        e.preventDefault();
        tweenRef.current?.kill();
        posRef.current += dx / (cardWRef.current * GAP);
        render();
        clearTimeout(snap);
        snap = setTimeout(() => go(Math.round(posRef.current), 0.45), 90);
      };
      stage?.addEventListener("wheel", onWheel, { passive: false });

      return () => {
        ro.disconnect();
        clearTimeout(snap);
        stage?.removeEventListener("wheel", onWheel);
        tweenRef.current?.kill();
        detachRef.current?.(); // don't strand drag listeners if we unmount mid-swipe
      };
    },
    { scope: stageRef }
  );

  /* ── Drag / swipe ── */

  /* Deliberately no setPointerCapture: capturing on the stage retargets the
     derived click to the stage, so the card's own onClick would never fire and
     tap-to-flip would silently die. Window listeners keep a drag alive outside
     the stage without stealing the click. */
  const onDown = (e: React.PointerEvent) => {
    tweenRef.current?.kill();
    const d = dragRef.current;
    d.on = true;
    d.startX = e.clientX;
    d.startPos = posRef.current;
    d.moved = 0;

    const move = (ev: PointerEvent) => {
      if (!d.on) return;
      const dx = ev.clientX - d.startX;
      d.moved = Math.max(d.moved, Math.abs(dx));
      posRef.current = d.startPos - dx / (cardWRef.current * GAP);
      render();
    };
    const up = () => {
      if (!d.on) return;
      d.on = false;
      detachRef.current?.();
      go(Math.round(posRef.current), 0.5);
    };

    detachRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      detachRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const onCardClick = (i: number) => {
    if (dragRef.current.moved > 6) return; // that was a drag, not a tap
    const d = delta(i, posRef.current);
    if (Math.abs(d) < 0.5) {
      setFlipped((prev) => {
        const s = new Set(prev);
        if (s.has(i)) s.delete(i);
        else s.add(i);
        return s;
      });
    } else {
      go(posRef.current + d);
    }
  };

  return (
    <section id="board" className="relative border-t border-line/60 bg-[#070707]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
        <SectionHeading
          kicker="Leadership"
          title="Executive Board"
          sub="The officers who steer ICPEP BulSU Meneses Campus — students and faculty who lead by building, organizing, and showing up for every member."
        />

        <div
          ref={stageRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Executive board"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              step(-1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              step(1);
            }
          }}
          onPointerDown={onDown}
          /* overflow-hidden matters: the far cards sit ~380px either side of
             centre, which is wider than a phone — unclipped they'd drag the
             whole page sideways. */
          className="relative mt-14 h-85 cursor-grab select-none overflow-hidden outline-none active:cursor-grabbing sm:h-110 lg:h-120"
          style={{ perspective: "1600px", touchAction: "pan-y" }}
        >
          {roster.map((o, i) => (
            <div
              key={o.name}
              ref={(el) => {
                if (el) cardsRef.current[i] = el;
              }}
              className="absolute left-1/2 top-1/2 aspect-4/5 w-[clamp(200px,54vw,290px)]"
              style={{ transformStyle: "preserve-3d", willChange: "transform" }}
            >
              <button
                type="button"
                tabIndex={i === active ? 0 : -1}
                onClick={() => onCardClick(i)}
                aria-label={
                  i === active
                    ? `${o.name}, ${o.role}. Flip card`
                    : `${o.name}, ${o.role}. Bring to front`
                }
                className="relative block h-full w-full rounded-3xl outline-none transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                style={{
                  transformStyle: "preserve-3d",
                  transform: flipped.has(i) ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                <CardFront o={o} />
                <CardBack o={o} index={i} />
              </button>
            </div>
          ))}
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 font-head text-xs uppercase tracking-widest text-muted-foreground">
          <Hand size={14} className="text-primary/70" /> Drag to browse · Tap a card to flip
        </p>

        <p aria-live="polite" className="sr-only">
          {roster[active].name}, {roster[active].role}
        </p>
      </div>
    </section>
  );
}
