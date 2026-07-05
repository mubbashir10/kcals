import { SkeletonScaffold, SkeletonCard } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold title="Settings" maxWidth="max-w-md">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-3.5 w-56" />
      </div>
      <div className="space-y-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-2.5 w-24" />
            <SkeletonCard className="h-20" />
          </div>
        ))}
      </div>
    </SkeletonScaffold>
  );
}
