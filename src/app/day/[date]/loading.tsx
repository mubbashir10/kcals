import { SkeletonScaffold, SkeletonCard } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    // The real header title is a formatted date, so stand in with a bar.
    <SkeletonScaffold title={<Skeleton className="h-4 w-28" />}>
      <div className="space-y-4">
        <SkeletonCard className="h-28" />
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-40" />
      </div>
    </SkeletonScaffold>
  );
}
