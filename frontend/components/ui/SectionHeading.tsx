import Reveal from "./Reveal";

interface SectionHeadingProps {
  kicker?: string;
  title: string;
  sub?: string;
}

export default function SectionHeading({ kicker, title, sub }: SectionHeadingProps) {
  return (
    <Reveal className="mb-12 md:mb-16">
      {kicker && (
        <p className="font-head font-semibold tracking-[0.35em] uppercase text-primary text-xs md:text-sm mb-3">
          {kicker}
        </p>
      )}
      <h2 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-wide text-foreground">
        {title}
      </h2>
      <div className="mt-4 h-1 w-20 bg-gradient-to-r from-primary to-primary-glow rounded-full shadow-glow-sm" />
      {sub && (
        <p className="mt-5 max-w-2xl text-secondary-foreground leading-relaxed">{sub}</p>
      )}
    </Reveal>
  );
}
