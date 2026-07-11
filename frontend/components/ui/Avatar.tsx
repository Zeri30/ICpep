import Image from "next/image";

interface AvatarProps {
  name: string;
  /** Optional real photo (URL or /public path). Falls back to initials. */
  photo?: string;
  size?: number;
  /** Accent color for the ring + initials tint. Defaults to crimson. */
  accent?: string;
  className?: string;
}

/** Derive up to two initials from a full name. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Uniform circular avatar. Shows a real photo when provided, otherwise a
    tasteful initials monogram tinted with the team accent. */
export default function Avatar({
  name,
  photo,
  size = 72,
  accent = "#dc2626",
  className = "",
}: AvatarProps) {
  return (
    <span
      className={`relative inline-grid place-items-center shrink-0 rounded-full overflow-hidden border ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: `${accent}55`,
        background: `linear-gradient(140deg, ${accent}26, #0a0a0a 78%)`,
      }}
    >
      {photo ? (
        <Image
          src={photo}
          alt={name}
          width={size}
          height={size}
          className="w-full h-full object-cover"
        />
      ) : (
        <span
          className="font-display font-bold leading-none select-none"
          style={{ fontSize: size * 0.36, color: accent }}
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}
