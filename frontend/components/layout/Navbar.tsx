"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import Logo from "@/components/ui/Logo";
import { NAV_LINKS } from "@/lib/data";
import { useActiveSection } from "@/lib/useActiveSection";
import { easeOutExpo } from "@/components/ui/motion-primitives";

const SECTION_IDS = NAV_LINKS.map((l) => l.id);

export default function Navbar() {
  const active = useActiveSection(SECTION_IDS);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 glass border-b ${
          scrolled ? "border-line shadow-[0_8px_30px_rgba(0,0,0,0.5)]" : "border-transparent"
        }`}
      >
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-4">
          {/* Logo */}
          <a href="#home" className="flex items-center gap-3 shrink-0 group">
            <span className="grid place-items-center w-11 h-11 rounded-full transition-[filter] drop-shadow-[0_0_10px_rgba(220,38,38,0.35)] group-hover:drop-shadow-[0_0_16px_rgba(220,38,38,0.55)]">
              <Logo size={44} priority className="w-11 h-11" />
            </span>
            <span className="leading-tight">
              <span className="block font-display font-bold tracking-widest text-sm text-foreground">
                ICpEP.SE
              </span>
              <span className="block font-head text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                BulSU Meneses
              </span>
            </span>
          </a>

          {/* Desktop links */}
          <ul className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  className={`relative px-3 py-2 text-[13px] font-medium tracking-wide transition-colors ${
                    active === l.id
                      ? "text-primary-glow"
                      : "text-secondary-foreground hover:text-foreground"
                  }`}
                >
                  {l.label}
                  {active === l.id && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute left-3 right-3 -bottom-0.5 h-0.5 bg-primary rounded-full shadow-glow-sm"
                    />
                  )}
                </a>
              </li>
            ))}
          </ul>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <motion.a
              href="#membership"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="hidden sm:inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-xs font-head font-semibold uppercase tracking-widest text-white hover:bg-accent shadow-glow-sm hover:shadow-glow transition-all"
            >
              Join Us <ArrowRight size={14} />
            </motion.a>
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden grid place-items-center w-11 h-11 rounded-md border border-line text-foreground hover:border-primary/50 hover:text-primary-glow transition-colors"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              key="sheet"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.35, ease: easeOutExpo }}
              className="fixed top-0 right-0 bottom-0 z-[70] w-[82%] max-w-sm bg-card border-l border-line flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between px-6 h-[72px] border-b border-line">
                <span className="flex items-center gap-2.5">
                  <Logo size={32} className="w-8 h-8" />
                  <span className="font-display font-bold tracking-widest text-sm">
                    ICpEP.SE <span className="text-primary">MENU</span>
                  </span>
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="grid place-items-center w-11 h-11 rounded-md border border-line hover:border-primary/50 hover:text-primary-glow transition-colors"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-6 py-6">
                <ul className="space-y-1">
                  {NAV_LINKS.map((l, i) => (
                    <motion.li
                      key={l.id}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.06 * i, duration: 0.3 }}
                    >
                      <a
                        href={`#${l.id}`}
                        onClick={() => setOpen(false)}
                        className={`flex items-center justify-between rounded-md px-4 py-3.5 font-head font-semibold uppercase tracking-widest text-sm transition-colors ${
                          active === l.id
                            ? "text-primary-glow bg-primary/10 border border-primary/20"
                            : "text-secondary-foreground hover:text-foreground hover:bg-white/5"
                        }`}
                      >
                        {l.label}
                        <ChevronRight
                          size={16}
                          className={active === l.id ? "text-primary" : "text-muted-foreground"}
                        />
                      </a>
                    </motion.li>
                  ))}
                </ul>
              </nav>
              <div className="p-6 border-t border-line">
                <a
                  href="#membership"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 w-full rounded-md bg-primary py-4 font-head font-semibold uppercase tracking-widest text-sm text-white shadow-glow"
                >
                  Join Us <ArrowRight size={16} />
                </a>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
