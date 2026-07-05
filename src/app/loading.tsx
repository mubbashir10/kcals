import { Logo } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/page-skeleton";

// Fallback loading skeleton for the home dashboard (app/page.tsx) and any
// route that doesn't ship its own loading.tsx. Mirrors the home header
// (logo + greeting + user menu) and a stack of widget cards so navigation
// paints instantly instead of blanking while data streams from the DB.
export default function Loading() {
  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
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
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-6 py-12">
        <SkeletonCard className="h-44" />
        <div className="grid grid-cols-2 gap-4">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-32" />
      </main>
    </div>
  );
}
