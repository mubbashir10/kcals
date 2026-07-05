import {
  SkeletonScaffold,
  SkeletonCard,
  SkeletonRows,
} from "@/components/page-skeleton";

// Recipe detail skeleton. Without this, the parent recipes/loading.tsx (a
// "Recipes" list) is the Suspense fallback for /recipes/[id], flashing list
// rows on a single-recipe navigation.
export default function Loading() {
  return (
    <SkeletonScaffold title="Recipe">
      <div className="space-y-6">
        <SkeletonCard className="h-32" />
        <SkeletonRows count={5} />
      </div>
    </SkeletonScaffold>
  );
}
