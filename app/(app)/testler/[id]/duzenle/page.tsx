import { UnifiedTestFormPage } from "@/components/admin/tests/UnifiedTestFormPage";

export default async function EditTopicTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <UnifiedTestFormPage id={Number(id)} mode="edit" />;
}
