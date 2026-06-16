import { AgentQuestionGenerationDetailPage } from "@/components/admin/questions/AgentQuestionGenerationDetailPage";

export default async function Page({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  return <AgentQuestionGenerationDetailPage jobId={jobId} />;
}
