export function SkeletonBlock({
  className = "",
}: {
  className?: string;
}) {
  return <div className={`admin-skeleton ${className}`.trim()} />;
}

export function AdminTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid grid-cols-3 gap-3">
          <SkeletonBlock className="h-12" />
          <SkeletonBlock className="h-12" />
          <SkeletonBlock className="h-12" />
        </div>
      ))}
    </div>
  );
}

export function FullScreenSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-6xl space-y-4">
        <div className="grid gap-4 lg:grid-cols-[286px_1fr]">
          <SkeletonBlock className="h-[760px] rounded-[24px]" />
          <div className="space-y-4">
            <SkeletonBlock className="h-20 rounded-[22px]" />
            <SkeletonBlock className="h-[660px] rounded-[22px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
