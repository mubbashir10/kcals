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

// Effective calorie target = TDEE + offset, floored at BMR so an aggressive
// deficit never asks someone to eat below their resting requirements.
export function computeEffectiveTarget(
  tdee: number,
  bmr: number,
  type: GoalType,
  pace: GoalPace | null
): number {
  const target = tdee + computeKcalOffset(type, pace);
  return Math.max(Math.round(bmr), Math.round(target));
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
