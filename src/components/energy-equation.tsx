// The "at a glance" energy equation, shared by the home hero
// (BMR + burned − eaten) and the week page (eaten − burned). Same icons, same
// operators, same sign language everywhere: a positive result is what's left in
// the bank, a negative one is an overshoot and gets the destructive tone rather
// than a leading minus.

import { Sigma } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EqTerm({
  icon: Icon,
  value,
  label,
  strong = false,
  danger = false,
}: {
  icon: LucideIcon;
  value: number;
  label?: string;
  strong?: boolean;
  /** Over-budget — paint the icon + number in the destructive tone. */
  danger?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          danger ? "text-destructive" : "text-muted-foreground/70"
        )}
        strokeWidth={2}
      />
      <span
        className={cn(
          "tabular-nums",
          danger
            ? "font-semibold text-destructive"
            : strong
              ? "font-semibold text-foreground"
              : "font-medium text-foreground/70"
        )}
      >
        {value.toLocaleString()}
      </span>
      {label && <span className="text-muted-foreground/70">{label}</span>}
    </span>
  );
}

export function EqOp({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground/40">{children}</span>;
}

/**
 * The result of an energy equation. `remaining` is what's left of the burn
 * after eating: positive = still in the bank, negative = ate past it. The `=`
 * rides along so it never dangles at the end of a wrapped line.
 */
export function EqResult({ remaining }: { remaining: number }) {
  const over = remaining < 0;
  return (
    <span className="inline-flex items-center gap-2.5">
      <EqOp>=</EqOp>
      <EqTerm
        icon={Sigma}
        value={Math.abs(remaining)}
        label={
          remaining > 0 ? "remaining" : over ? "overconsumed" : undefined
        }
        strong
        danger={over}
      />
    </span>
  );
}
