import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Static, non-interactive clone of the inner-page sticky header (back
// chevron + real title) plus the ambient gradient and page container. Every
// inner route's loading.tsx renders this so the chrome paints *instantly*
// with the correct title, and only the body reads as loading. Mirrors the
// real headers in e.g. app/foods/page.tsx and app/settings/page.tsx.
export function SkeletonScaffold({
  title,
  maxWidth = "max-w-2xl",
  children,
}: {
  title: React.ReactNode;
  maxWidth?: "max-w-2xl" | "max-w-md";
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div
          className={cn(
            "mx-auto flex h-14 w-full items-center gap-3 px-6",
            maxWidth
          )}
        >
          {/* Non-interactive stand-in for the real back link — same footprint,
              dimmed so it doesn't invite a tap while the page is loading. */}
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/40">
            <ArrowLeft className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">{title}</span>
        </div>
      </header>

      <main className={cn("mx-auto w-full flex-1 px-6 py-8", maxWidth)}>
        {children}
      </main>
    </div>
  );
}

// A card-shaped block — for widget/summary skeletons.
export function SkeletonCard({ className }: { className?: string }) {
  return <Skeleton className={cn("h-32 w-full rounded-xl", className)} />;
}

// A list of avatar + two-line + trailing-value rows — for the many list
// screens (foods, recipes, friends, history).
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}
