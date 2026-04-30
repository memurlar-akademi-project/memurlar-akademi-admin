import { SubjectFormPage } from "@/components/admin/subjects/SubjectFormPage";

export default async function EditSubjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <SubjectFormPage id={Number(id)} mode="edit" />;
}
