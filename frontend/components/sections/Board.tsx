"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, MoveHorizontal } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import SectionHeading from "@/components/ui/SectionHeading";
import { API_URL } from "@/lib/config";
import { OFFICER_META, initialsOf, type Officer } from "@/lib/data";

const accentOf = (o: Officer) => (o.featured ? "#f59e0b" : "#dc2626");

/** One row of GET /api/officers — see backend OfficerController. */
type OfficerRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  isAdviser: boolean;
};

/**
 * The live roster from the admin's `users` table, merged with OFFICER_META
 * for the presentation that table has no column for. Adviser first regardless
 * of fetch order — the API already sends it first, but the deck's "front
 * card" assumption is worth keeping independent of that.
 *
 * Empty (not the old hardcoded fallback) while loading or on a failed fetch:
 * showing stale names would defeat the point of no longer hardcoding them.
 */
function useRoster(): Officer[] {
  const [rows, setRows] = useState<OfficerRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/api/officers`, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { data: OfficerRow[] } | null) => {
        if (!cancelled) setRows(data?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const officers: Officer[] = rows.map((r) => {
    const meta = OFFICER_META[r.email];
    return {
      name: r.name,
      role: r.isAdviser ? "Organization Adviser" : r.roleLabel,
      detail: meta?.detail ?? r.roleLabel,
      initials: initialsOf(r.name),
      featured: r.isAdviser,
      photo: meta?.photo,
      plainPortrait: meta?.plainPortrait,
    };
  });

  const adviser = officers.find((o) => o.featured);
  const rest = officers.filter((o) => !o.featured);
  return adviser ? [adviser, ...rest] : rest;
}

/* ─────────────────────────────────────────────────────────────────────────
   Coverflow deck

   Exactly five slide slots ever exist (previous2 / previous / current /
   next / next2). Each holds an officer index rather than being keyed to
   one, so navigating reassigns roles across the same five DOM nodes and
   lets CSS transitions animate the move instead of unmounting/remounting
   cards.

   Stepping shifts every role one position down the line — current becomes
   previous, next becomes current, next2 becomes next, and so on — so four
   of the five slots always keep their officer unchanged (they're just
   relabelled). Only the slot falling off the trailing edge (previous2 when
   stepping forward, next2 when stepping back) needs a new officer swapped
   in for its new position on the leading edge, and it's dropped below
   every other slot's z-index for that one transition so the swap happens
   out of sight, underneath the slides that are actually moving into view.
──────────────────────────────────────────────────────────────────────── */

type Role = "previous2" | "previous" | "current" | "next" | "next2";

interface Slot {
  slotId: number;
  role: Role;
  index: number;
  z: number;
}

const ROLE_STYLE: Record<Role, { tx: string; rotY: string; scale: number; z: number }> = {
  previous2: { tx: "calc(var(--slide-w) * -1.85)", rotY: "58deg", scale: 0.62, z: 10 },
  previous: { tx: "calc(var(--slide-w) * -1.05)", rotY: "40deg", scale: 0.85, z: 20 },
  current: { tx: "0px", rotY: "0deg", scale: 1.14, z: 30 },
  next: { tx: "calc(var(--slide-w) * 1.05)", rotY: "-40deg", scale: 0.85, z: 20 },
  next2: { tx: "calc(var(--slide-w) * 1.85)", rotY: "-58deg", scale: 0.62, z: 10 },
};

/** Role each slot moves into when stepping in `dir`; the omitted role on
    each side is the one recycled onto the opposite edge with new content. */
const ROLE_SHIFT: Record<1 | -1, Record<Role, Role>> = {
  1: { previous2: "next2", previous: "previous2", current: "previous", next: "current", next2: "next" },
  [-1]: { previous2: "previous", previous: "current", current: "next", next: "next2", next2: "previous2" },
};

/** How many `nav()` steps (and in which direction) bring a given role to
    the centre — used for click-to-navigate on any peeking card. */
const ROLE_JUMP: Record<Role, { dir: 1 | -1; steps: number } | null> = {
  previous2: { dir: -1, steps: 2 },
  previous: { dir: -1, steps: 1 },
  current: null,
  next: { dir: 1, steps: 1 },
  next2: { dir: 1, steps: 2 },
};

/* ─────────────────────────────────────────────────────────────────────────
   Slide
──────────────────────────────────────────────────────────────────────── */

/** Front = the officer's card art, shown whole. */
function CardFront({ officer, accent, isCurrent }: { officer: Officer; accent: string; isCurrent: boolean }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden rounded-3xl border bg-[#0d0d0d] transition-[filter] duration-700 ${
        isCurrent ? "brightness-100" : "brightness-[0.55]"
      }`}
      style={{ backfaceVisibility: "hidden", borderColor: `${accent}40` }}
    >
      {officer.photo ? (
        <Image
          src={officer.photo}
          alt={officer.name}
          fill
          sizes="(max-width: 640px) 60vw, 300px"
          draggable={false}
          loading="eager"
          className="select-none object-cover"
          style={{
            transform: "scale(1.18)",
            objectPosition: officer.plainPortrait ? "50% 18%" : undefined,
          }}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-6xl font-black" style={{ color: accent }}>
            {officer.initials}
          </span>
        </div>
      )}
    </div>
  );
}

/** Back = role / name / detail, revealed by flipping the current card. */
function CardBack({ officer, accent, index }: { officer: Officer; accent: string; index: number }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-3xl border bg-[#0b0b0b] px-4 text-center sm:px-6"
      style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderColor: `${accent}66` }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${accent}2e, transparent 70%)` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 grid select-none place-items-center font-display text-7xl font-black leading-none text-stroke opacity-20"
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="relative w-full">
        <p
          className="text-balance wrap-break-word font-display text-sm font-black uppercase leading-[1.15] sm:text-lg lg:text-xl"
          style={{ color: accent }}
        >
          {officer.role}
        </p>
        <span className="mx-auto mt-3 block h-1 w-10 rounded-full" style={{ background: accent }} />
        <p className="mt-3 text-balance wrap-break-word font-head text-[11px] uppercase leading-snug tracking-wide text-white sm:text-sm sm:tracking-widest">
          {officer.name}
        </p>
        <p className="mt-4 text-balance wrap-break-word text-xs text-muted-foreground">{officer.detail}</p>
      </div>
    </div>
  );
}

function BoardSlide({
  slot,
  officer,
  isFlipped,
  onClick,
}: {
  slot: Slot;
  officer: Officer | undefined;
  isFlipped: boolean;
  onClick: () => void;
}) {
  if (!officer) return null;

  const accent = accentOf(officer);
  const style = ROLE_STYLE[slot.role];
  const isCurrent = slot.role === "current";

  return (
    <div
      className="absolute left-1/2 top-1/2 aspect-4/5 w-(--slide-w) transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
      style={{
        zIndex: slot.z,
        transform: `translate3d(calc(-50% + ${style.tx}), -50%, 0) rotateY(${style.rotY}) scale(${style.scale})`,
        transformStyle: "preserve-3d",
      }}
    >
      <button
        type="button"
        tabIndex={isCurrent ? 0 : -1}
        onClick={onClick}
        aria-label={
          isCurrent
            ? `${officer.name}, ${officer.role}. Flip card`
            : `${officer.name}, ${officer.role}. Bring to front`
        }
        className="relative block h-full w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={{ perspective: "1200px" }}
      >
        <div
          className="relative h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <CardFront officer={officer} accent={accent} isCurrent={isCurrent} />
          <CardBack officer={officer} accent={accent} index={slot.index} />
        </div>
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Board
──────────────────────────────────────────────────────────────────────── */

export default function Board() {
  const roster = useRoster();
  const n = roster.length;

  const [active, setActive] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [flipped, setFlipped] = useState<Set<number>>(() => new Set());

  const wrap = useCallback((i: number) => (n === 0 ? 0 : ((i % n) + n) % n), [n]);

  // Seeds once the roster first arrives (n goes 0 -> N). Adjusting state
  // during render, gated on a comparison against the last render, rather
  // than in an effect — React's documented pattern for state that depends
  // on a value that changes (here, an async-arriving prop) instead of on
  // an event.
  const [seededN, setSeededN] = useState(0);
  if (n > 0 && seededN === 0) {
    setSeededN(n);
    setSlots([
      { slotId: 0, role: "previous2", index: wrap(-2), z: ROLE_STYLE.previous2.z },
      { slotId: 1, role: "previous", index: wrap(-1), z: ROLE_STYLE.previous.z },
      { slotId: 2, role: "current", index: 0, z: ROLE_STYLE.current.z },
      { slotId: 3, role: "next", index: wrap(1), z: ROLE_STYLE.next.z },
      { slotId: 4, role: "next2", index: wrap(2), z: ROLE_STYLE.next2.z },
    ]);
    setActive(0);
  }

  /** Steps the whole deck by one position in `dir`. */
  const nav = useCallback(
    (dir: 1 | -1) => {
      if (n === 0) return;
      setSlots((prev) => {
        if (prev.length < 5) return prev;
        const cur = prev.find((s) => s.role === "current")!;
        const newActive = wrap(cur.index + dir);
        const shift = ROLE_SHIFT[dir];
        // The role vacating the trailing edge is the one recycled with new content.
        const recycledFrom: Role = dir === 1 ? "previous2" : "next2";

        return prev.map((s) => {
          const newRole = shift[s.role];
          if (s.role === recycledFrom) {
            const newIndex = dir === 1 ? wrap(newActive + 2) : wrap(newActive - 2);
            return { ...s, role: newRole, index: newIndex, z: 5 };
          }
          return { ...s, role: newRole, z: ROLE_STYLE[newRole].z };
        });
      });
      setActive((a) => wrap(a + dir));
      setFlipped(new Set()); // moving to a different officer drops any open flip
    },
    [n, wrap]
  );

  const toggleFlip = useCallback((index: number) => {
    setFlipped((prev) => {
      const s = new Set(prev);
      if (s.has(index)) s.delete(index);
      else s.add(index);
      return s;
    });
  }, []);

  return (
    <section id="board" className="relative overflow-hidden border-t border-line/60 bg-[#070707]">
      {/* Ambient backdrop — the current slide's own photo, blurred and
          scrimmed, echoing it back behind the deck. Scoped to the section
          (not viewport-fixed like the source) so it doesn't bleed into
          neighbouring sections when scrolled past. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {slots.map((slot) => {
          const officer = roster[slot.index];
          if (!officer?.photo) return null;
          return (
            <div
              key={slot.slotId}
              className="absolute inset-[-10%] bg-cover bg-center transition-[opacity,transform] duration-700 motion-reduce:transition-none"
              style={{
                backgroundImage: `url(${officer.photo})`,
                filter: "blur(36px) saturate(1.15)",
                opacity: slot.role === "current" ? 0.4 : 0,
                transform:
                  slot.role === "previous"
                    ? "translateX(-4%)"
                    : slot.role === "next"
                      ? "translateX(4%)"
                      : "translateX(0)",
              }}
            />
          );
        })}
        <div className="absolute inset-0 bg-black/80" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
        <SectionHeading
          kicker="Leadership"
          title="Executive Board"
          sub="The officers who steer ICPEP BulSU Meneses Campus — students and faculty who lead by building, organizing, and showing up for every member."
        />

        <div className="mt-14 flex items-center justify-center gap-3 sm:gap-6">
          <button
            type="button"
            onClick={() => nav(-1)}
            disabled={n === 0}
            aria-label="Previous officer"
            className="inline-flex shrink-0 items-center justify-center text-white opacity-70 transition-opacity duration-250 ease-out hover:opacity-100 disabled:opacity-30"
          >
            <ChevronLeft size={40} strokeWidth={2} />
          </button>

          <div
            role="region"
            aria-roledescription="carousel"
            aria-label="Executive board"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                nav(-1);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                nav(1);
              }
            }}
            /* overflow-hidden matters: peeking cards sit past the stage's
               own box on narrow viewports — unclipped they'd spill into the
               nav buttons and drag the page sideways. */
            className="relative h-85 w-full max-w-6xl overflow-hidden select-none outline-none sm:h-110 lg:h-120"
            style={
              {
                perspective: "1400px",
                "--slide-w": "clamp(140px, 30vw, 260px)",
              } as CSSProperties
            }
          >
            {slots.map((slot) => {
              const jump = ROLE_JUMP[slot.role];
              return (
                <BoardSlide
                  key={slot.slotId}
                  slot={slot}
                  officer={roster[slot.index]}
                  isFlipped={slot.role === "current" && flipped.has(slot.index)}
                  onClick={() => {
                    if (jump) {
                      for (let i = 0; i < jump.steps; i++) nav(jump.dir);
                    } else {
                      toggleFlip(slot.index);
                    }
                  }}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => nav(1)}
            disabled={n === 0}
            aria-label="Next officer"
            className="inline-flex shrink-0 items-center justify-center text-white opacity-70 transition-opacity duration-250 ease-out hover:opacity-100 disabled:opacity-30"
          >
            <ChevronRight size={40} strokeWidth={2} />
          </button>
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 font-head text-xs uppercase tracking-widest text-muted-foreground">
          <MoveHorizontal size={14} className="text-primary/70" /> Use the arrows or click a card to browse
        </p>

        {roster[active] && (
          <p aria-live="polite" className="sr-only">
            {roster[active].name}, {roster[active].role}
          </p>
        )}
      </div>
    </section>
  );
}
