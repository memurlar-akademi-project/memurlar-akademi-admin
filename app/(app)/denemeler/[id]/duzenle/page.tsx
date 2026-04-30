import { MockExamFormPage } from "@/components/admin/mock-exams/MockExamFormPage";

export default async function EditMockExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <MockExamFormPage id={Number(id)} mode="edit" />;
}
