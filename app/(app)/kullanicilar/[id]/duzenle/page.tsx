import { notFound } from "next/navigation";
import { UserFormPage } from "@/components/admin/users/UserFormPage";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = Number(id);

  if (Number.isNaN(userId)) {
    notFound();
  }

  return <UserFormPage id={userId} mode="edit" />;
}
