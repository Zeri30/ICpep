"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

/**
 * Interactive crimson particle constellation for the hero.
 * - Cursor moving: nearby particles drift toward the pointer and glowing lines connect.
 * - Click / tap: emits an expanding shockwave ripple that pushes particles outward.
 * - Press + drag: a stronger pull that gathers particles into the cursor's wake.
 * Falls back to a static field when the user prefers reduced motion.
 */
export default function InteractiveHeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    const ripples: Ripple[] = [];
    const pointer = { x: -9999, y: -9999, active: false, down: false };

    const LINK_DIST = 130;
    const POINTER_DIST = 180;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(28, Math.min(96, Math.floor((width * height) / 15000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: 1 + Math.random() * 1.8,
      }));
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(239,68,68,0.5)";
        ctx.fill();
      }
    };

    resize();

    if (reduceMotion) {
      drawStatic();
      const onResizeStatic = () => {
        resize();
        drawStatic();
      };
      window.addEventListener("resize", onResizeStatic);
      return () => window.removeEventListener("resize", onResizeStatic);
    }

    const pointerFromEvent = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active =
        pointer.x >= 0 && pointer.x <= width && pointer.y >= 0 && pointer.y <= height;
    };

    const onMove = (e: PointerEvent) => pointerFromEvent(e);

    const onDown = (e: PointerEvent) => {
      pointerFromEvent(e);
      if (!pointer.active) return;
      pointer.down = true;
      ripples.push({ x: pointer.x, y: pointer.y, radius: 0, alpha: 0.55 });
      // Instant shockwave: push nearby particles outward.
      for (const p of particles) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 220) {
          const force = (1 - dist / 220) * 4;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }
    };

    const onUp = () => {
      pointer.down = false;
    };

    const onLeave = () => {
      pointer.active = false;
      pointer.down = false;
      pointer.x = -9999;
      pointer.y = -9999;
    };

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      // Update + draw connection lines from pointer.
      for (const p of particles) {
        // Pointer attraction / drag pull.
        if (pointer.active) {
          const dx = pointer.x - p.x;
          const dy = pointer.y - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < POINTER_DIST) {
            const pull = (1 - dist / POINTER_DIST) * (pointer.down ? 0.9 : 0.28);
            if (dist > 26) {
              p.vx += (dx / dist) * pull * 0.4;
              p.vy += (dy / dist) * pull * 0.4;
            } else {
              // Gentle repulsion when very close so they orbit instead of collapsing.
              p.vx -= (dx / dist) * 0.2;
              p.vy -= (dy / dist) * 0.2;
            }

            // Glowing link line to the pointer.
            const a = (1 - dist / POINTER_DIST) * 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.strokeStyle = `rgba(239,68,68,${a})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // Friction + speed clamp.
        p.vx *= 0.96;
        p.vy *= 0.96;
        const speed = Math.hypot(p.vx, p.vy);
        const max = 2.2;
        if (speed > max) {
          p.vx = (p.vx / speed) * max;
          p.vy = (p.vy / speed) * max;
        }
        // Idle drift so the field never fully stops.
        p.vx += (Math.random() - 0.5) * 0.02;
        p.vy += (Math.random() - 0.5) * 0.02;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges.
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
      }

      // Particle-to-particle links.
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.22;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(220,38,38,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Particles.
      for (const p of particles) {
        const near = pointer.active
          ? Math.hypot(pointer.x - p.x, pointer.y - p.y) < POINTER_DIST
          : false;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = near ? "rgba(248,113,113,0.95)" : "rgba(239,68,68,0.6)";
        ctx.fill();
        if (near) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(239,68,68,0.15)";
          ctx.fill();
        }
      }

      // Ripples.
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.radius += 6;
        rp.alpha *= 0.94;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239,68,68,${rp.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        if (rp.alpha < 0.03 || rp.radius > Math.max(width, height)) {
          ripples.splice(i, 1);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
