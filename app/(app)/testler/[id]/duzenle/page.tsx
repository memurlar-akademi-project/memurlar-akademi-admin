import { TopicTestFormPage } from "@/components/admin/tests/TopicTestFormPage";

export default async function EditTopicTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <TopicTestFormPage id={Number(id)} mode="edit" />;
}
