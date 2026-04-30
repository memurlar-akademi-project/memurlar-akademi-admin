import { ExamFormPage } from "@/components/admin/exams/ExamFormPage";

export default async function EditExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ExamFormPage id={Number(id)} mode="edit" />;
}
