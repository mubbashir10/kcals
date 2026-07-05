import { cn } from "@/lib/utils";

// Shimmer placeholder block. Rendered by loading.tsx files so navigation
// paints an instant, app-like skeleton instead of a blank screen while the
// (force-dynamic) server component fetches from the DB. The tint matches
// the card ring (foreground/10) so skeletons read as "content, loading".
export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-foreground/10", className)}
      {...props}
    />
  );
}
