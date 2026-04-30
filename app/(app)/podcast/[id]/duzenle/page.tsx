import { PodcastLessonFormPage } from "@/components/admin/podcast/PodcastLessonFormPage";

export default async function EditPodcastLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;

  return <PodcastLessonFormPage id={Number(resolvedParams.id)} mode="edit" />;
}
