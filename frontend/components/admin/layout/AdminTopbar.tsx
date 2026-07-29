"use client";

import { Menu } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";
import SignOutButton from "@/components/admin/layout/SignOutModal";
import { familyStyle, findRole } from "@/lib/roleFamily";

export default function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  const { officer, meta } = useAdmin();
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
        <SignOutButton />
      </div>
    </header>
  );
}
