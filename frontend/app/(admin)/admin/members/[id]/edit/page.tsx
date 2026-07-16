import MemberForm from "@/components/admin/members/MemberForm";

export default async function MemberEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberForm id={id} />;
}
