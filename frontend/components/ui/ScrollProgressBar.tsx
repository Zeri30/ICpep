"use client";

import { motion, useScroll, useSpring } from "motion/react";

/** Thin crimson bar at the very top that tracks overall page scroll progress. */
export default function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.3,
  });

  return (
    <motion.div
      style={{ scaleX }}
      className="fixed top-0 left-0 right-0 z-[90] h-[3px] origin-left bg-gradient-to-r from-primary via-primary-glow to-primary shadow-glow-sm"
    />
  );
}
