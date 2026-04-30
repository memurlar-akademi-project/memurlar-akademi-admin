import { HapBilgiFormPage } from "@/components/admin/flashcards/HapBilgiFormPage";

export default async function EditHapBilgiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;

  return <HapBilgiFormPage id={Number(resolvedParams.id)} mode="edit" />;
}
