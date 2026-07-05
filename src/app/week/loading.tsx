import { SkeletonScaffold, SkeletonCard } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold title="This week">
      <div className="space-y-4">
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-28" />
        <SkeletonCard className="h-28" />
      </div>
    </SkeletonScaffold>
  );
}
