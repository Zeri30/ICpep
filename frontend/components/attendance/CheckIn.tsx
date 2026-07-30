"use client";

/* The page a scanned QR opens. Its only job now is handing the token to
   CheckInModal — see that file for the actual check-in flow, which is shared
   with the topbar's own QR button and anywhere else attendance needs
   recording from. This page exists because a QR already printed and handed
   out points at a fixed URL (Event::checkInUrl()) that has to resolve to
   *something*, not because the flow itself needs a page of its own.

   Closing here has nowhere to fall back to behind it, unlike the modal
   opened from within the admin shell — so it sends the officer to the
   dashboard instead of just disappearing. */

import { useRouter } from "next/navigation";
import CheckInModal from "@/components/attendance/CheckInModal";

export default function CheckIn({ token }: { token: string | null }) {
  const router = useRouter();

  return (
    <main className="min-h-dvh bg-background">
      <CheckInModal open token={token} onClose={() => router.push("/admin")} />
    </main>
  );
}
