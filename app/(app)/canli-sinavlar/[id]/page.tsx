import { notFound } from "next/navigation";
import { LiveExamWorkspace } from "@/components/admin/live-exams/LiveExamWorkspace";

export default async function ManageLiveExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);

  if (!Number.isInteger(eventId) || eventId < 1) notFound();

  return <LiveExamWorkspace initialSelectedId={eventId} />;
}
