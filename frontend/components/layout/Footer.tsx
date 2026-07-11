import { Mail } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { Facebook, Github } from "@/components/ui/BrandIcons";
import { NAV_LINKS, CONTACT } from "@/lib/data";

export default function Footer() {
  return (
    <footer className="relative bg-background border-t border-primary/40">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <a href="#home" className="flex items-center gap-3">
              <Logo size={48} className="w-12 h-12 drop-shadow-[0_0_12px_rgba(220,38,38,0.3)]" />
              <span className="leading-tight">
                <span className="block font-display font-bold tracking-widest text-sm">ICpEP.SE</span>
                <span className="block font-head text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                  BulSU Meneses
                </span>
              </span>
            </a>
            <p className="mt-5 max-w-sm text-sm text-secondary-foreground leading-relaxed">
              The official organization of Computer Engineering students at Bulacan State University –
              Meneses Campus. Engineering the future, one line of code at a time.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="font-head font-semibold uppercase tracking-widest text-xs text-foreground mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2.5">
              {NAV_LINKS.map((l) => (
                <li key={l.id}>
                  <a
                    href={`#${l.id}`}
                    className="text-sm text-secondary-foreground hover:text-primary-glow transition-colors"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="font-head font-semibold uppercase tracking-widest text-xs text-foreground mb-4">
              Connect
            </h4>
            <div className="flex items-center gap-3">
              <a
                href={CONTACT.facebookUrl}
                aria-label="Facebook"
                className="grid place-items-center w-10 h-10 rounded-md border border-line text-secondary-foreground hover:text-primary-glow hover:border-primary/50 transition-colors"
              >
                <Facebook size={18} />
              </a>
              <a
                href={`mailto:${CONTACT.email}`}
                aria-label="Email"
                className="grid place-items-center w-10 h-10 rounded-md border border-line text-secondary-foreground hover:text-primary-glow hover:border-primary/50 transition-colors"
              >
                <Mail size={18} />
              </a>
              <a
                href="#"
                aria-label="GitHub"
                className="grid place-items-center w-10 h-10 rounded-md border border-line text-secondary-foreground hover:text-primary-glow hover:border-primary/50 transition-colors"
              >
                <Github size={18} />
              </a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed">{CONTACT.email}</p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-line/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © 2025 ICPEP BulSU Meneses Campus. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground font-head uppercase tracking-widest">
            Engineering the Future
          </p>
        </div>
      </div>
    </footer>
  );
}
