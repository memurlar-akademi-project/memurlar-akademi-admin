import { MinistryFormPage } from "@/components/admin/ministries/MinistryFormPage";

export default async function EditMinistryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <MinistryFormPage id={Number(id)} mode="edit" />;
}
