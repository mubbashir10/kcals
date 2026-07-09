import { SkeletonScaffold, SkeletonRows } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold
      title="Calories & macros"
      action={<Skeleton className="h-8 w-8 rounded-full" />}
    >
      <div className="space-y-6">
        <Skeleton className="h-56 w-full rounded-xl" />
        <SkeletonRows count={6} />
      </div>
    </SkeletonScaffold>
  );
}
