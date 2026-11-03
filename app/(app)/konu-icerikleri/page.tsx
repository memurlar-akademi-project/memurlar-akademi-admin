import TopicContentsPage from "@/components/admin/TopicContentsPage";

function positiveId(value: string | string[] | undefined): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const subjectId = positiveId(params.subjectId);
  const topicId = positiveId(params.topicId);
  return <TopicContentsPage key={`${subjectId}:${topicId}`} initialSubjectId={subjectId?.toString() ?? "all"} initialTopicId={topicId} />;
}
