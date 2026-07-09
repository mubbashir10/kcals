import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonBrandHeader,
  SkeletonCard,
  SkeletonShell,
} from "@/components/page-skeleton";

// Loading skeleton for the home dashboard (app/page.tsx). Mirrors the real
// header and the hero + widget stack so navigation paints instantly instead of
// blanking while data streams from the DB. Pre-auth (/signin) and onboarding
// (/setup) ship their own loading.tsx so this authenticated chrome never leaks
// onto them.
export default function Loading() {
  return (
    <SkeletonShell header={<SkeletonBrandHeader />}>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="mb-8 space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-44" />
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
