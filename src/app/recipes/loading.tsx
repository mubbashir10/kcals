import { SkeletonScaffold, SkeletonRows } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold title="Recipes">
      <SkeletonRows count={6} />
    </SkeletonScaffold>
  );
}
