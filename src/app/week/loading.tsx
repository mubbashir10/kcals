import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { SkeletonCard, SkeletonShell } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// The week header is a nav pill, not a title — so this can't use
// SkeletonScaffold. The pill's chrome (tint, chevrons) is known at build time
// and drawn for real; only its label depends on which week loads, so that's the
// one bar. Mirrors the header in app/week/page.tsx.
export default function Loading() {
  return (
    <SkeletonShell
      header={
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-2 px-6">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </span>
          <div className="flex items-center gap-0.5 rounded-full bg-primary/10 py-0.5 pl-0.5 pr-1 text-primary">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full">
              <ChevronLeft className="h-4 w-4" />
            </span>
            <Skeleton className="mx-1.5 h-3.5 w-20" />
            <span className="inline-flex h-7 w-7 items-center justify-center text-primary/25">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      }
    >
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="space-y-4">
          <SkeletonCard className="h-40" />
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
      </main>
    </SkeletonShell>
  );
}
