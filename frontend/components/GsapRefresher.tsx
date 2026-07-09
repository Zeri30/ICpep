"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";

gsap.registerPlugin(ScrollTrigger);

/**
 * Recomputes every ScrollTrigger once the page has actually settled.
 * The pinned Events reel measures its width on mount, but the Orbitron/Rajdhani
 * display fonts load a beat later and widen the track — without a refresh the
 * pin distance is stale and the following section overlaps it. We refresh after
 * fonts are ready, on window load, and after the intro loading screen clears.
 */
export default function GsapRefresher() {
  useEffect(() => {
    ScrollTrigger.config({ ignoreMobileResize: true });

    const refresh = () => ScrollTrigger.refresh();

    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(refresh);
    }
    window.addEventListener("load", refresh);

    // After the LoadingScreen (~1.5s) unmounts and everything is laid out.
    const t1 = window.setTimeout(refresh, 1700);
    const t2 = window.setTimeout(refresh, 2600);

    return () => {
      window.removeEventListener("load", refresh);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return null;
}
