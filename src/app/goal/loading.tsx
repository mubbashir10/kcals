import {
  SkeletonScaffold,
  SkeletonCard,
  SkeletonHeading,
} from "@/components/page-skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold>
      <SkeletonHeading width="w-24" />
      <div className="space-y-4">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-48" />
        <SkeletonCard className="h-24" />
      </div>
    </SkeletonScaffold>
  );
}
