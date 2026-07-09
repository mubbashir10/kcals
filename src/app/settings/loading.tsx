import {
  SkeletonScaffold,
  SkeletonCard,
  SkeletonHeading,
} from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold>
      <SkeletonHeading width="w-36" />
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
