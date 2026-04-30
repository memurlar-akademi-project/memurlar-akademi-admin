import { SubjectTestFormPage } from "@/components/admin/tests/SubjectTestFormPage";

export default async function EditSubjectTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <SubjectTestFormPage id={Number(id)} mode="edit" />;
}
