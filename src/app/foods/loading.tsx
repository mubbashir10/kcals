import { SkeletonScaffold, SkeletonRows } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold title="My foods">
      <SkeletonRows count={8} />
    </SkeletonScaffold>
  );
}
