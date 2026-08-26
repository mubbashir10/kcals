// The app's dashed pill — a secondary action that reads as "and also…"
// rather than a filled button: "New meal", "Describe a meal", "Just add
// calories". Two sizes: `lg` sits under a list of cards, `sm` sits in a row
// of chips under a search field.
//
// One definition because these appear side by side (the dashboard renders
// two of them next to each other), where any drift is immediately visible.

import { cn } from "@/lib/utils";

export function dashedPill(size: "sm" | "lg" = "lg"): string {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-full border border-dashed border-border bg-transparent font-medium transition-all hover:border-foreground/40 hover:bg-accent/40 hover:text-foreground",
    size === "lg"
      ? "h-10 px-5 text-sm text-foreground/80"
      : "h-8 px-4 text-xs text-muted-foreground"
  );
}
