"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import Logo from "@/components/ui/Logo";

/** Sleek intro loader: ICPEP name fades in, then the panel slides up to reveal the page. */
export default function LoadingScreen() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDone(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="loader"
          exit={{ y: "-100%" }}
          transition={{ duration: 0.65, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="mb-6 drop-shadow-[0_0_28px_rgba(220,38,38,0.5)]"
          >
            <Logo size={96} priority className="w-20 h-20 md:w-28 md:h-28" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, letterSpacing: "0.6em" }}
            animate={{ opacity: 1, letterSpacing: "0.25em" }}
            transition={{ delay: 0.15, duration: 0.9, ease: "easeOut" }}
            className="font-display font-black text-4xl md:text-6xl text-primary text-glow-red uppercase"
          >
            ICpEP.SE
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="mt-3 font-head tracking-[0.45em] uppercase text-xs text-muted-foreground"
          >
            BulSU Meneses Campus
          </motion.p>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.3, duration: 0.9, ease: "easeInOut" }}
            className="mt-8 h-0.5 w-40 origin-left bg-gradient-to-r from-primary to-primary-glow shadow-glow"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
