"use client";

import { Menu, QrCode } from "lucide-react";
import { useState } from "react";
import AccountMenu from "@/components/admin/layout/AccountMenu";
import CheckInModal from "@/components/attendance/CheckInModal";

export default function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  const [scannerOpen, setScannerOpen] = useState(false);

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
          <AccountMenu />
        </div>
      </div>

      <CheckInModal open={scannerOpen} onClose={() => setScannerOpen(false)} />
    </header>
  );
}
