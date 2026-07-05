import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonShell } from "@/components/page-skeleton";

// Onboarding/profile setup skeleton. No sticky header (the real page hides it
// for first-time setup) and no dashboard chrome — /setup runs post-auth but
// pre-profile, so the home loading.tsx would otherwise leak calorie widgets
// onto a user who hasn't set anything up yet.
export default function Loading() {
  return (
    <SkeletonShell>
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
        <div className="mb-8 space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <div className="space-y-4">
          <SkeletonCard className="h-40" />
          <SkeletonCard className="h-40" />
          <SkeletonCard className="h-24" />
        </div>
      </main>
    </SkeletonShell>
  );
}
