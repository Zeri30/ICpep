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
      if (!ref.current) return;
      // A CSS-hidden instance (`display: none` on some ancestor) has no box
      // to click "outside" of. Without this guard, the responsive lists that
      // mount both a desktop and a mobile copy of the same row — only one of
      // which is ever visible — fire this listener on the *hidden* copy for
      // every click in the *visible* one's completely separate subtree,
      // closing it (and unmounting its button) before the click it was on
      // can register. offsetParent is null exactly when an ancestor is
      // display:none, which is the only way this hook's callers ever hide
      // one of these duplicates (never visibility:hidden/opacity:0).
      if (ref.current.offsetParent === null) return;
      if (!ref.current.contains(e.target as Node)) onOutsideRef.current();
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
