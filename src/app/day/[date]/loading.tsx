import {
  SkeletonBrandHeader,
  SkeletonCard,
  SkeletonShell,
} from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// The day page is the home dashboard for another date — same chrome, same hero.
export default function Loading() {
  return (
    <SkeletonShell header={<SkeletonBrandHeader />}>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="mb-8 space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-4">
          <SkeletonCard className="h-[26rem] rounded-3xl" />
          <SkeletonCard className="h-32 rounded-3xl" />
          <SkeletonCard className="h-40 rounded-3xl" />
        </div>
      </main>
    </SkeletonShell>
  );
}
