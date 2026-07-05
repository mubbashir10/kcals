import { Logo } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonShell } from "@/components/page-skeleton";

// Loading skeleton for the home dashboard (app/page.tsx). Mirrors the home
// header (logo + greeting + user menu) and a stack of widget cards so
// navigation paints instantly instead of blanking while data streams from
// the DB. Pre-auth (/signin) and onboarding (/setup) ship their own
// loading.tsx so this authenticated chrome never leaks onto them.
export default function Loading() {
  return (
    <SkeletonShell
      header={
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Logo className="h-9 w-9" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      }
    >
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-6 py-12">
        <SkeletonCard className="h-44" />
        <div className="grid grid-cols-2 gap-4">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-32" />
      </main>
    </SkeletonShell>
  );
}
