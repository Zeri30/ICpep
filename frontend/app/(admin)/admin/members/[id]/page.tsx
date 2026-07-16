import MemberView from "@/components/admin/members/MemberView";

export default async function MemberViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberView id={id} />;
}
