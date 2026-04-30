import { QuestionImportReviewPage } from "@/components/admin/imports/QuestionImportReviewPage";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function QuestionImportReviewRoute({ params }: Props) {
  const resolvedParams = await params;

  return <QuestionImportReviewPage importId={Number(resolvedParams.id)} />;
}
