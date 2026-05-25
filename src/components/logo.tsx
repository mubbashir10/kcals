import { cn } from "@/lib/utils";

// kcals mark — rendered from /public/logo.svg, the single source of truth
// shared with the favicon (wired via metadata.icons in app/layout.tsx).
export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.svg" alt="kcals" className={cn("shrink-0", className)} />
  );
}
