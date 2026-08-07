"use client";

import { Mail, MapPin } from "lucide-react";
import { Facebook } from "@/components/ui/BrandIcons";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import PresentationInner from "@/components/ui/PresentationInner";
import { CONTACT } from "@/lib/data";

const INFO = [
  { icon: Facebook, label: "Facebook", value: CONTACT.facebook, href: CONTACT.facebookUrl },
  { icon: Mail, label: "Email", value: CONTACT.email, href: CONTACT.emailComposeUrl },
  { icon: MapPin, label: "Location", value: CONTACT.location, href: undefined },
];

export default function Contact() {
  return (
    <section id="contact" className="relative bg-[#070707] border-t border-line/60">
      <PresentationInner className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <SectionHeading
          kicker="Reach Out"
          title="Get in Touch"
          sub="Questions, partnerships, or just want to say hi? We'd love to hear from you."
        />

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Info */}
          <Reveal>
            <div className="space-y-4">
              {INFO.map((item) => {
                const content = (
                  <div className="flex items-start gap-4 rounded-xl bg-card border border-line p-6 hover:border-primary/40 transition-colors">
                    <span className="grid place-items-center w-12 h-12 shrink-0 rounded-lg bg-primary/10 text-primary-glow border border-primary/20">
                      <item.icon size={22} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-head font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                        {item.label}
                      </p>
                      <p className="text-foreground font-medium leading-snug wrap-anywhere">{item.value}</p>
                    </div>
                  </div>
                );
                return item.href ? (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {content}
                  </a>
                ) : (
                  <div key={item.label}>{content}</div>
                );
              })}
            </div>
          </Reveal>

          {/* Map */}
          <Reveal delay={0.1}>
            <div className="relative rounded-xl overflow-hidden border border-line h-full min-h-[320px] bg-card">
              <iframe
                title="Bulacan State University – Meneses Campus map"
                src={CONTACT.mapEmbed}
                className="map-dark absolute inset-0 h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-primary/10" />
            </div>
          </Reveal>
        </div>
      </PresentationInner>
    </section>
  );
}
