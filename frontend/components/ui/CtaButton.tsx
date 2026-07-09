"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

interface CtaButtonProps {
  href: string;
  children: ReactNode;
  variant?: "solid" | "outline";
  className?: string;
}

export default function CtaButton({
  href,
  children,
  variant = "solid",
  className = "",
}: CtaButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-head font-semibold uppercase tracking-widest text-sm px-7 py-3.5 transition-colors duration-200 select-none";
  const styles =
    variant === "solid"
      ? "bg-primary text-primary-foreground hover:bg-accent shadow-glow"
      : "border border-primary/60 text-primary-glow hover:bg-primary/10 hover:border-primary";

  return (
    <motion.a
      href={href}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </motion.a>
  );
}
