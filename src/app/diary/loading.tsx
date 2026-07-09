import { SkeletonScaffold, SkeletonRows } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold title="Food diary">
      <SkeletonRows count={8} />
    </SkeletonScaffold>
  );
}
