import type { ReactNode } from "react";

interface MarqueeProps {
  items: string[];
  reverse?: boolean;
  /** Rendered between items. */
  separator?: ReactNode;
  className?: string;
}

/**
 * Infinite horizontal marquee. The item list is rendered twice back-to-back and
 * translated by -50% so the loop is seamless. Pauses on hover.
 */
export default function Marquee({
  items,
  reverse = false,
  separator,
  className = "",
}: MarqueeProps) {
  const sep = separator ?? (
    <span className="mx-6 text-primary/70" aria-hidden="true">
      ✦
    </span>
  );

  // Built as an element rather than a nested component: a component declared in
  // the render body is a new type on every render, so React would tear down and
  // rebuild both rows each time instead of updating them.
  const row = (ariaHidden?: boolean) => (
    <span className="flex items-center" aria-hidden={ariaHidden}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center">
          <span className="whitespace-nowrap">{item}</span>
          {sep}
        </span>
      ))}
    </span>
  );

  return (
    <div className={`marquee-wrap relative overflow-hidden ${className}`}>
      <div className={`marquee-track ${reverse ? "reverse" : ""}`}>
        {row()}
        {/* The duplicate is what makes the -50% loop seamless; it is hidden from
            assistive tech so the items are not announced twice. */}
        {row(true)}
      </div>
    </div>
  );
}
