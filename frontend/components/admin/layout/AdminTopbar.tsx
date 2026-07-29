"use client";

import { Menu, QrCode } from "lucide-react";
import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import SignOutButton from "@/components/admin/layout/SignOutModal";
import CheckInModal from "@/components/attendance/CheckInModal";
import { familyStyle, findRole } from "@/lib/roleFamily";

export default function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  const { officer, meta } = useAdmin();
  const [scannerOpen, setScannerOpen] = useState(false);
  // Tinted with the officer's own branch of the organization, from the same map
  // that colours the role badges in User Management — so a colour means the same
  // thing wherever it appears. Falls back to the neutral shade when the account
  // has no role.
  const roleTint = familyStyle(findRole(meta.roles, officer.role)?.family).text;

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center gap-4 border-b border-line bg-[#070707]/90 px-4 backdrop-blur sm:px-6">
      <button
        onClick={onMenu}
        aria-label="Toggle menu"
        className="grid size-10 place-items-center rounded-md border border-line text-secondary-foreground transition-colors hover:text-foreground lg:hidden"
      >
        <Menu size={18} />
      </button>

      <div className="ml-auto flex items-center gap-4">
        <div className="hidden flex-col items-end leading-tight sm:flex">
          <span className={`font-head text-[10px] font-semibold uppercase tracking-[0.2em] ${officer.roleLabel ? roleTint : "text-muted-foreground"}`}>
            {officer.roleLabel ?? "Welcome back"}
          </span>
          <span className="text-sm font-semibold text-foreground">{officer.name}</span>
        </div>

        {/* Mobile only, in the corner sign-out used to sit in — see
            AdminSidebar for where sign-out went instead. */}
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          aria-label="Scan attendance QR"
          title="Scan attendance QR"
          className="grid size-10 place-items-center rounded-md border border-primary/50 text-primary transition-colors hover:bg-primary/10 sm:hidden"
        >
          <QrCode size={18} />
        </button>

        <div className="hidden sm:block">
          <SignOutButton />
        </div>
      </div>

      <CheckInModal open={scannerOpen} onClose={() => setScannerOpen(false)} />
    </header>
  );
}
