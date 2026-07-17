import UserForm from "@/components/admin/users/UserForm";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserForm id={id} />;
}
