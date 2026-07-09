import { SkeletonScaffold, SkeletonRows } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold
      title="Recipes"
      action={<Skeleton className="h-8 w-28 rounded-full" />}
    >
      <SkeletonRows count={6} />
    </SkeletonScaffold>
  );
}
