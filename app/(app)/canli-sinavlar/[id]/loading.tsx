import { AdminTableSkeleton } from "@/components/ui/Skeleton";

export default function LoadingLiveExam() {
  return <div className="admin-card overflow-hidden"><AdminTableSkeleton rows={6} /></div>;
}
