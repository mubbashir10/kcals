import { SkeletonScaffold, SkeletonRows } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold title="Weight">
      <div className="space-y-6">
        <Skeleton className="h-56 w-full rounded-xl" />
        <SkeletonRows count={6} />
      </div>
    </SkeletonScaffold>
  );
}
