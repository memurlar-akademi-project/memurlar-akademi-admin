import { TopicFormPage } from "@/components/admin/topics/TopicFormPage";

export default async function EditTopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <TopicFormPage id={Number(id)} mode="edit" />;
}
