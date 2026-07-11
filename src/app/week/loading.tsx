import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { SkeletonCard, SkeletonShell } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonShell
      header={
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center px-6">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </span>
        </div>
      }
    >
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="mb-8 flex w-fit items-center gap-0.5 rounded-full bg-primary/10 py-0.5 pl-0.5 pr-1 text-primary">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full">
            <ChevronLeft className="h-4 w-4" />
          </span>
          <Skeleton className="mx-1.5 h-3.5 w-20" />
          <span className="inline-flex h-7 w-7 items-center justify-center text-primary/25">
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>
        <div className="space-y-4">
          <SkeletonCard className="h-40" />
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
      </main>
    </SkeletonShell>
  );
}
