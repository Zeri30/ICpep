"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { easeOutExpo } from "./motion-primitives";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}

/** Fades + slides a block up when it scrolls into view (once). */
export default function Reveal({
  children,
  className = "",
  delay = 0,
  y = 28,
}: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay, ease: easeOutExpo }}
    >
      {children}
    </motion.div>
  );
}
