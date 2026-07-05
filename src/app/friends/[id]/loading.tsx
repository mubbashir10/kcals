import { SkeletonScaffold, SkeletonCard } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Friend detail skeleton. Without this, the parent friends/loading.tsx (a
// "Friends" list) is the Suspense fallback for /friends/[id], flashing list
// rows on a single-friend navigation. The real header title is the friend's
// name, so stand in with a bar.
export default function Loading() {
  return (
    <SkeletonScaffold title={<Skeleton className="h-4 w-24" />}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
        </div>
        <SkeletonCard className="h-56" />
      </div>
    </SkeletonScaffold>
  );
}
