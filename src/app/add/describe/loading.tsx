import { SkeletonScaffold, SkeletonRows } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold title="Describe a meal">
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <SkeletonRows count={3} />
      </div>
    </SkeletonScaffold>
  );
}
