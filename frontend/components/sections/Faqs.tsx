"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import PresentationInner from "@/components/ui/PresentationInner";
import { FAQS } from "@/lib/data";

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Reveal delay={index * 0.05}>
      <div
        className={`rounded-xl border bg-card overflow-hidden transition-colors ${
          open ? "border-primary/40" : "border-line hover:border-line"
        }`}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
          aria-expanded={open}
        >
          <span className="font-head font-semibold text-base md:text-lg text-foreground">{q}</span>
          <motion.span
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.25 }}
            className={`grid place-items-center w-8 h-8 shrink-0 rounded-full border ${
              open ? "border-primary/40 text-primary-glow bg-primary/10" : "border-line text-secondary-foreground"
            }`}
          >
            <Plus size={16} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="px-6 pb-5 text-secondary-foreground leading-relaxed">{a}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  );
}

export default function Faqs() {
  return (
    <section id="faqs" className="relative bg-background border-t border-line/60">
      <PresentationInner className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <SectionHeading
          kicker="Questions"
          title="FAQs"
          sub="Everything you need to know before joining ICPEP BulSU Meneses Campus."
        />
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <FaqItem key={f.q} q={f.q} a={f.a} index={i} />
          ))}
        </div>
      </PresentationInner>
    </section>
  );
}
