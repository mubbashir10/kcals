// Goal feature — applies a daily kcal offset (deficit or surplus) on top
// of the user's TDEE to derive their "effective calorie target". The
// calorie ring and macros widget both read from the effective target.
//
// Pace math: convert kg-per-week into kcal-per-day using the standard
// 7,700 kcal/kg fat conversion (≈ 9 kcal/g × 1000 g/kg minus a small
// water/glycogen offset; 7,700 is the dietetics-textbook number).
//
//   mild       0.25 kg/wk  →  275 kcal/day
//   moderate   0.50 kg/wk  →  550 kcal/day
//   aggressive 0.75 kg/wk  →  825 kcal/day

// Dietetics-textbook energy density of body-weight change. The pace offsets
// below derive from it (e.g. 0.5 kg/wk × 7700 ÷ 7 ≈ 550 kcal/day), and the
// week summary uses it to turn a net deficit/surplus into a predicted Δweight.
export const KCAL_PER_KG = 7700;

export const GOAL_TYPES = ["loss", "maintain", "gain", "track"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_PACES = ["mild", "moderate", "aggressive"] as const;
export type GoalPace = (typeof GOAL_PACES)[number];

export const PACE_KCAL_PER_DAY: Record<GoalPace, number> = {
  mild: 275,
  moderate: 550,
  aggressive: 825,
};

export const PACE_KG_PER_WEEK: Record<GoalPace, number> = {
  mild: 0.25,
  moderate: 0.5,
  aggressive: 0.75,
};

export function isGoalType(s: string | null | undefined): s is GoalType {
  return s != null && (GOAL_TYPES as readonly string[]).includes(s);
}

export function isGoalPace(s: string | null | undefined): s is GoalPace {
  return s != null && (GOAL_PACES as readonly string[]).includes(s);
}

// Signed kcal offset to apply to TDEE.
//   loss  → negative (eat under maintenance)
//   gain  → positive
//   maintain/track → 0
export function computeKcalOffset(
  type: GoalType,
  pace: GoalPace | null
): number {
  if (type === "loss" && pace) return -PACE_KCAL_PER_DAY[pace];
  if (type === "gain" && pace) return PACE_KCAL_PER_DAY[pace];
  return 0;
}

// Effective calorie target: maintenance (TDEE) plus the goal's signed offset,
// applied as chosen. Deliberately NOT floored at BMR — TDEE already exceeds
// BMR by the day's activity, so flooring there cancels most of a deficit
// (a 1,642 BMR against a 2,140 TDEE would swallow anything past ~500) and
// silently hands back a target the user didn't pick. Under-BMR targets get a
// heads-up in the UI instead; see isBelowBmr.
//
// For track, the user picks the number directly and we respect it verbatim.
// Falls back to TDEE when track is selected but no number is set yet.
//
// `minKcal` is the one real floor — the lactation minimum that protects milk
// supply. It's capped at TDEE so it can only lift a *deficit* back up, never
// push the target above maintenance: a petite nursing mother whose maintenance
// already sits below the floor (TDEE 1,660 vs an 1,800 floor) would otherwise
// be told to eat above maintenance, which would make her gain.
export function computeEffectiveTarget(
  tdee: number,
  type: GoalType,
  pace: GoalPace | null,
  trackKcal: number | null = null,
  minKcal: number = 0
): number {
  const floor = Math.min(minKcal, Math.round(tdee));
  if (type === "track") {
    const target =
      trackKcal != null && trackKcal > 0 ? trackKcal : tdee;
    return Math.max(Math.round(target), floor);
  }
  const target = tdee + computeKcalOffset(type, pace);
  return Math.max(Math.round(target), floor);
}

// Eating under BMR isn't a hard danger line — you burn above BMR over a day,
// so a real deficit often lands there. It's worth a quiet heads-up, not a cap.
export function isBelowBmr(target: number, bmr: number): boolean {
  return target < Math.round(bmr);
}

export function goalTypeLabel(type: GoalType): string {
  switch (type) {
    case "loss":
      return "Lose";
    case "gain":
      return "Gain";
    case "maintain":
      return "Maintain";
    case "track":
      return "Track";
  }
}

export function goalPaceLabel(pace: GoalPace): string {
  switch (pace) {
    case "mild":
      return "Mild";
    case "moderate":
      return "Moderate";
    case "aggressive":
      return "Aggressive";
  }
}
