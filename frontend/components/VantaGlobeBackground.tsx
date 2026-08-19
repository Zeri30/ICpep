"use client";

import { useEffect, useRef } from "react";

/**
 * Rotating wireframe globe for the hero, built on Vanta's GLOBE effect (three.js).
 * Skips entirely under prefers-reduced-motion, matching the particle background it replaces.
 */
export default function VantaGlobeBackground() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let effect: { destroy: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const [THREE, { default: GLOBE }] = await Promise.all([
        import("three"),
        import("vanta/dist/vanta.globe.min"),
      ]);
      if (cancelled || !host) return;

      effect = GLOBE({
        el: host,
        THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        scale: 1.0,
        scaleMobile: 1.0,
        color: 0xdc2626,
        color2: 0xdc2626,
        backgroundColor: 0x050505,
        backgroundAlpha: 0,
        size: 1.1,
      });
    })();

    return () => {
      cancelled = true;
      effect?.destroy();
    };
  }, []);

  return <div ref={hostRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
