import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { metricTint } from "@/lib/metric-colors";

// A colorful rounded icon chip — the "metric tile" look modern fitness apps
// (Google Health / Apple Health) use for each stat. `color` is a theme CSS var
// so the tile re-tints with the active theme; the icon sits in a translucent
// wash of the same hue.
export function MetricBadge({
  icon: Icon,
  color,
  className,
}: {
  icon: LucideIcon;
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
        className
      )}
      style={{ backgroundColor: metricTint(color), color }}
    >
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}
