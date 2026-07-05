import { SkeletonScaffold, SkeletonCard } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold title="Goal" maxWidth="max-w-md">
      <div className="space-y-4">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-48" />
        <SkeletonCard className="h-24" />
      </div>
    </SkeletonScaffold>
  );
}
