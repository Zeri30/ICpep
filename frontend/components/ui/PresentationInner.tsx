"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import type { ReactNode } from "react";
import { useRef } from "react";

interface PresentationInnerProps {
  children: ReactNode;
  className?: string;
  /** Disable the subtle scale (used where it would fight layout animations). */
  scale?: boolean;
}

/**
 * Wraps a section's inner content and drives scroll-scrubbed motion so scrolling
 * feels like slides transitioning: content drifts up, brightens as it reaches the
 * center of the viewport ("spotlight"), then dims and drifts away as it leaves.
 * The section's full-bleed background stays put — only the content moves — so
 * there are never any seams between sections.
 */
export default function PresentationInner({
  children,
  className = "",
  scale = true,
}: PresentationInnerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.22, 0.8, 1], [0.25, 1, 1, 0.25]);
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [56, 0, -40]);
  const scaleValue = useTransform(scrollYProgress, [0, 0.22, 0.8, 1], [0.965, 1, 1, 0.985]);

  if (reduceMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      style={scale ? { opacity, y, scale: scaleValue } : { opacity, y }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
