import { QuestionFormPage } from "@/components/admin/questions/QuestionFormPage";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <QuestionFormPage id={Number(id)} mode="edit" />;
}
