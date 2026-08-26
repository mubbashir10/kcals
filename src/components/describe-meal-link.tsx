import { Sparkles } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { dashedPill } from "@/lib/pill";
import { cn } from "@/lib/utils";

// Entry points to free-form logging — "peanut butter 16g, two slices of
// bread and honey for breakfast" instead of five trips through search.
// Two shapes, one href rule: an inline pill where it sits among other
// actions (the /add chip row), and a floating button on the day pages,
// where it's the standing shortcut rather than one option in a list.

function describeHref(dayKey?: string | null): string {
  return dayKey ? `/add/describe?day=${dayKey}` : "/add/describe";
}

export function DescribeMealLink({
  dayKey,
  size = "lg",
  label = "Describe a meal",
}: {
  /** Day to log onto. Omitted means today. */
  dayKey?: string | null;
  size?: "sm" | "lg";
  label?: string;
}) {
  return (
    <AppLink href={describeHref(dayKey)} className={dashedPill(size)}>
      <Sparkles className={size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {label}
    </AppLink>
  );
}

/**
 * The floating version, pinned bottom-right of the day pages.
 *
 * The row tracks the content column rather than the viewport, so on a wide
 * screen the button sits at the edge of the page's own text rather than
 * marooned in the far corner. `pointer-events-none` on the row keeps the
 * empty space beside it clickable — only the button itself catches taps.
 *
 * z-30 leaves it under the install / update banners (z-40), which are
 * dismissible and already draw over page content.
 */
export function DescribeMealFab({
  dayKey,
  className,
}: {
  dayKey?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-30 pb-[calc(env(safe-area-inset-bottom)+1rem)]",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-2xl justify-end px-6">
        <AppLink
          href={describeHref(dayKey)}
          aria-label="Describe a meal"
          title="Describe a meal"
          className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-card-lg transition-transform active:translate-y-px"
        >
          <Sparkles className="h-6 w-6" />
        </AppLink>
      </div>
    </div>
  );
}
