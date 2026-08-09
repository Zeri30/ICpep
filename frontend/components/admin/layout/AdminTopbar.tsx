"use client";

import { Menu, QrCode } from "lucide-react";
import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import AccountMenu from "@/components/admin/layout/AccountMenu";
import CheckInModal from "@/components/attendance/CheckInModal";

export default function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  const { officer } = useAdmin();
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
        {/* Every screen size, not just mobile — this is the only quick way to
            reach the scanner outside of an event's own "Status & QR" tab.
            Not for the Programming Team: that account runs the system rather
            than holding a seat on the org chart, so it has no attendance to
            scan in — the endpoint refuses it the same way (see
            AttendanceController::store()). */}
        {officer.role !== "programming_team" && (
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            aria-label="Scan attendance QR"
            title="Scan attendance QR"
            className="grid size-10 place-items-center rounded-md border border-primary/50 text-primary transition-colors hover:bg-primary/10"
          >
            <QrCode size={18} />
          </button>
        )}

        <div className="hidden sm:block">
          <AccountMenu />
        </div>
      </div>

      <CheckInModal open={scannerOpen} onClose={() => setScannerOpen(false)} />
    </header>
  );
}
