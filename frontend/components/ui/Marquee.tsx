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

  const Row = ({ ariaHidden }: { ariaHidden?: boolean }) => (
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
        <Row />
        <Row ariaHidden />
      </div>
    </div>
  );
}
