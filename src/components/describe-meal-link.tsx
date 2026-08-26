import { Sparkles } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { dashedPill } from "@/lib/pill";

// Entry point to free-form logging — "peanut butter 16g, two slices of
// bread and honey for breakfast" instead of five trips through search.
// Styled as the dashed sibling of NewMealButton, which it sits next to.
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
    <AppLink
      href={dayKey ? `/add/describe?day=${dayKey}` : "/add/describe"}
      className={dashedPill(size)}
    >
      <Sparkles className={size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {label}
    </AppLink>
  );
}
