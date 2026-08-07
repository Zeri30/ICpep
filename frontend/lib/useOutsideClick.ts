"use client";

/* Closes a menu/dropdown/popover on an outside click, and — for the handful
   that already offered it — on Escape too. Every menu in this codebase
   implemented this by hand, byte-for-byte identical in five places and a
   close variant (document listener + Escape) in two more; this is the one
   copy all seven now share. */

import { useEffect, useRef, type RefObject } from "react";

/**
 * @param ref The menu/panel element — a mousedown landing outside it closes
 *   the menu; one landing inside is left alone.
 * @param onOutside Called on a qualifying outside click (and, if
 *   `closeOnEscape`, on Escape) — typically `() => setOpen(false)` for a menu
 *   that owns its own open state, or a parent-supplied `onClose` for one
 *   that doesn't. Read through a ref internally (the same always-fresh-ref
 *   shape used elsewhere in this codebase — see useVisibilityInterval), so
 *   passing a fresh inline callback on every render doesn't tear down and
 *   reattach the listeners each time.
 * @param enabled Listeners are only attached while true, so a closed menu
 *   has nothing live to detach later — matches every existing
 *   implementation's own `if (!open) return` guard.
 * @param closeOnEscape Off by default, matching most of this codebase's
 *   existing menus; the two that already handled Escape (AccountMenu,
 *   Navbar's Join Us dropdown) opt in so their behavior is unchanged.
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  enabled: boolean,
  opts: { closeOnEscape?: boolean } = {},
): void {
  const { closeOnEscape = false } = opts;

  const onOutsideRef = useRef(onOutside);
  useEffect(() => {
    onOutsideRef.current = onOutside;
  });

  useEffect(() => {
    if (!enabled) return;

    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutsideRef.current();
    };
    window.addEventListener("mousedown", onMouseDown);

    const onKeyDown = closeOnEscape
      ? (e: KeyboardEvent) => {
          if (e.key === "Escape") onOutsideRef.current();
        }
      : null;
    if (onKeyDown) window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      if (onKeyDown) window.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, enabled, closeOnEscape]);
}
