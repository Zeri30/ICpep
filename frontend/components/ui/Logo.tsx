import Image from "next/image";
import logoSrc from "@/public/icpep-logo.png";

interface LogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
}

/** The ICpEP.SE – BulSU Meneses Campus gear emblem. */
export default function Logo({ size = 40, className = "", priority = false }: LogoProps) {
  return (
    <Image
      src={logoSrc}
      alt="ICpEP.SE – BulSU Meneses Campus logo"
      width={size}
      height={size}
      priority={priority}
      className={`object-contain select-none ${className}`}
    />
  );
}
