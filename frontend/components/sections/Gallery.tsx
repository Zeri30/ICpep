"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import SectionHeading from "@/components/ui/SectionHeading";
import PresentationInner from "@/components/ui/PresentationInner";
import { GALLERY_CATEGORIES, GALLERY_ITEMS } from "@/lib/data";

export default function Gallery() {
  const [filter, setFilter] = useState<(typeof GALLERY_CATEGORIES)[number]>("All");

  const items = GALLERY_ITEMS.filter((g) => filter === "All" || g.category === filter);

  return (
    <section id="gallery" className="relative bg-background border-t border-line/60">
      <PresentationInner scale={false} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <SectionHeading
          kicker="Moments"
          title="Gallery"
          sub="A look back at the workshops, competitions, and community moments that make ICPEP more than an organization."
        />

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2.5 mb-10">
          {GALLERY_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-full border px-4 py-2 text-xs font-head font-semibold uppercase tracking-widest transition-colors ${
                filter === cat
                  ? "bg-primary text-white border-primary shadow-glow-sm"
                  : "bg-card text-secondary-foreground border-line hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <motion.div layout className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {items.map((g) => (
              <motion.div
                key={g.id}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4 }}
                className="group relative aspect-square rounded-xl overflow-hidden border border-line hover:border-primary/50 transition-colors cursor-pointer"
                style={{ background: `linear-gradient(135deg, ${g.tint}, #0a0a0a 70%)` }}
              >
                <div className={`absolute inset-0 ${g.pattern} opacity-60`} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-primary/5 transition-colors" />

                {/* Center icon */}
                <div className="absolute inset-0 grid place-items-center">
                  <g.icon
                    size={34}
                    className="text-white/40 group-hover:text-primary-glow group-hover:scale-110 transition-all duration-300"
                  />
                </div>

                {/* Category chip (top) */}
                <span className="absolute top-3 left-3 rounded-full bg-black/50 backdrop-blur border border-white/10 px-2.5 py-1 text-[10px] font-head font-semibold uppercase tracking-widest text-secondary-foreground">
                  {g.category}
                </span>

                {/* Title overlay (on hover) */}
                <div className="absolute inset-x-0 bottom-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="font-head font-semibold text-sm text-foreground leading-tight">{g.title}</p>
                </div>

                {/* Glow ring on hover */}
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-transparent group-hover:ring-primary/30 group-hover:shadow-[inset_0_0_20px_rgba(220,38,38,0.15)] transition-all" />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {items.length === 0 && (
          <p className="text-center text-muted-foreground py-16">No photos in this category yet.</p>
        )}
      </PresentationInner>
    </section>
  );
}
