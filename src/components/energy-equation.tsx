// The "at a glance" energy equation, shared by the day views
// (BMR + burned ± goal − eaten) and the week page (eaten − burned). Same icons,
// same operators, same sign language everywhere: a positive result is what's
// left in the bank, a negative one is an overshoot and gets the destructive
// tone rather than a leading minus.

import { Flame, HeartPulse, Sigma, Target, Utensils } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { projectedPill, projectionSentence } from "@/components/projected-value";
import type { BurnProjection } from "@/lib/daily-snapshot";
import { cn } from "@/lib/utils";

export function EqTerm({
  icon: Icon,
  value,
  label,
  strong = false,
  danger = false,
  projected = false,
  title,
}: {
  icon: LucideIcon;
  value: number;
  label?: string;
  strong?: boolean;
  /** Over-budget — paint the icon + number in the destructive tone. */
  danger?: boolean;
  /** Part forecast rather than measured — tilde it and tint the term. */
  projected?: boolean;
  /** Hover explanation. Touch can't reach it, so never put the only
   *  explanation here — this repeats what a nearby caption already says. */
  title?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        projected && projectedPill,
        projected && "gap-1.5"
      )}
      title={title}
    >
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
            : strong || projected
              ? "font-semibold text-foreground"
              : "font-medium text-foreground/70"
        )}
      >
        {projected && "~"}
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
 * A day's whole equation, terms only — the caller owns the container. Shared
 * verbatim by the day hero and the calendar's day preview so the preview stays
 * a preview rather than a second, differently-shaped truth.
 *
 * The goal term is derived from the target instead of read off the raw pace
 * offset, so the line reconciles with the ring whatever moved the target — the
 * deficit or surplus, a lactation allowance, the BMR floor, a hand-set "just
 * track" number — and so the printed terms always sum to the printed result
 * rather than drifting by a rounding step. Without it the line would total
 * what's left of the *burn* while the ring counts down from the *target*: two
 * different numbers, both called "remaining".
 */
export function EqDayBalance({
  bmr,
  burned,
  eaten,
  goal,
  burnProjection = null,
  lactationKcal = 0,
}: {
  bmr: number;
  burned: number;
  eaten: number;
  /** Effective calorie target — the number the ring counts down from. */
  goal: number;
  /** Set while `burned` is still part forecast — today, before today is over.
   *  Marks the term so the line doesn't pass an estimate off as a reading. */
  burnProjection?: BurnProjection | null;
  /** Milk, which `burned` also folds in. Named in the projection's tooltip so
   *  its parts still add up to the term they annotate. */
  lactationKcal?: number;
}) {
  // Burned/eaten aren't labelled — the flame/fork icons carry them, which keeps
  // the line to one row. The projected burn is the exception: it earns the word
  // because a number nobody can reconcile against their band is worse than a
  // slightly longer line.
  return (
    <>
      <EqTerm icon={HeartPulse} value={bmr} label="BMR" />
      <EqOp>+</EqOp>
      <EqTerm
        icon={Flame}
        value={burned}
        label={burnProjection ? "est." : undefined}
        projected={!!burnProjection}
        title={
          burnProjection
            ? projectionSentence(burnProjection, lactationKcal)
            : undefined
        }
      />
      <EqGoalTerm adjust={goal - (bmr + burned)} />
      <EqOp>−</EqOp>
      <EqTerm icon={Utensils} value={eaten} />
      <EqResult remaining={goal - eaten} />
    </>
  );
}

// The goal's slice of the day: eat this far above (surplus) or below (deficit)
// what you burn. Nothing to show at zero — maintain puts target and burn on the
// same number.
function EqGoalTerm({ adjust }: { adjust: number }) {
  if (adjust === 0) return null;
  const surplus = adjust > 0;
  return (
    <>
      <EqOp>{surplus ? "+" : "−"}</EqOp>
      <EqTerm
        icon={Target}
        value={Math.abs(adjust)}
        label={surplus ? "surplus" : "deficit"}
      />
    </>
  );
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
