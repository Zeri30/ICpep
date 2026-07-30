import { redirect } from "next/navigation";
import ChangePasswordForm from "@/components/ui/ChangePasswordForm";
import { fetchMe } from "@/lib/serverMe";

export const dynamic = "force-dynamic";

/* Deliberately outside the (admin) route group: an account forced here has
   nothing else to reach yet, so this renders on its own — no sidebar, no
   topbar, nothing suggesting the rest of the admin is one click away. */
export default async function ChangePasswordPage() {
  const me = await fetchMe();

  if (!me) redirect("/");
  // Nothing to do here once the flag is already clear — back to the admin.
  if (!me.user.mustChangePassword) redirect("/admin");

  return <ChangePasswordForm email={me.user.email} />;
}
