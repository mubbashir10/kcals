import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonHeading, SkeletonShell } from "@/components/page-skeleton";

// Onboarding/profile setup skeleton. No sticky header (the real page hides it
// for first-time setup) and no dashboard chrome — /setup runs post-auth but
// pre-profile, so the home loading.tsx would otherwise leak calorie widgets
// onto a user who hasn't set anything up yet.
//
// The body is a form, not a card stack: a label + control per row, at the real
// control heights (input h-8, segmented toggle h-9) so nothing shifts on swap.
function FieldRow() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}

export default function Loading() {
  return (
    <SkeletonShell>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <SkeletonHeading width="w-40" />

        <div className="space-y-8">
          {/* Units — label left, segmented toggle right. */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-9 w-44 rounded-full" />
          </div>

          {/* Sex — full-width segmented toggle. */}
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-10" />
            <Skeleton className="h-9 w-full rounded-full" />
          </div>

          {/* Age, height, weight, body fat. */}
          <FieldRow />
          <FieldRow />
          <FieldRow />
          <FieldRow />

          {/* Activity section rule. */}
          <div className="flex items-center gap-3 pt-2">
            <Skeleton className="h-3 w-24" />
            <div className="h-px flex-1 bg-border/60" />
          </div>

          {/* Source toggle, then steps + the two session rows. */}
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-9 w-full rounded-full" />
          </div>
          <FieldRow />
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-32" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          </div>

          <Skeleton className="h-9 w-full rounded-full" />
        </div>
      </main>
    </SkeletonShell>
  );
}
