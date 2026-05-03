import { FlashcardImportReviewPage } from "@/components/admin/imports/FlashcardImportReviewPage";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FlashcardImportReviewRoute({ params }: Props) {
  const resolvedParams = await params;

  return <FlashcardImportReviewPage importId={Number(resolvedParams.id)} />;
}
