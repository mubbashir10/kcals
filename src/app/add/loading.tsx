import { SkeletonScaffold, SkeletonRows } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold title="Add food">
      <div className="space-y-6">
        <Skeleton className="h-11 w-full rounded-full" />
        <SkeletonRows count={7} />
      </div>
    </SkeletonScaffold>
  );
}
