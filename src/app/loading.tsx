import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonBrandHeader,
  SkeletonCard,
  SkeletonShell,
} from "@/components/page-skeleton";

// Loading skeleton for the home dashboard (app/page.tsx), and the day page, which
// is the same dashboard for another date. Mirrors the real
// header and the hero + widget stack so navigation paints instantly instead of
// blanking while data streams from the DB. Pre-auth (/signin) and onboarding
// (/setup) ship their own loading.tsx so this authenticated chrome never leaks
// onto them.
export default function Loading() {
  return (
    <SkeletonShell header={<SkeletonBrandHeader />}>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-8 pt-6 sm:px-6 lg:max-w-5xl">
        <Skeleton className="mb-5 h-11 w-52" />
        <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-10 lg:space-y-0">
          <SkeletonCard className="h-[34rem] rounded-3xl" />
          <div className="space-y-4">
            <SkeletonCard className="h-32 rounded-3xl" />
            <SkeletonCard className="h-40 rounded-3xl" />
          </div>
        </div>
      </main>
    </SkeletonShell>
  );
}
