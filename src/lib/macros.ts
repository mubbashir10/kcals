// Macro goal compute helpers.
//
// Each macro has three independent modes:
//   "auto"   → derive grams from calorie goal × default split (30/40/30 P/C/F)
//   "custom" → use the user-provided gram value
//   "off"    → user explicitly opted out; UI shows ∞ / no progress
//
// The split lives here so dialing it in is a one-line change later.

export const MACRO_MODES = ["auto", "custom", "off"] as const;
export type MacroMode = (typeof MACRO_MODES)[number];

export const MACROS = ["protein", "carbs", "fat"] as const;
export type Macro = (typeof MACROS)[number];

// Calories per gram — basic dietetics constants.
export const KCAL_PER_G: Record<Macro, number> = {
  protein: 4,
  carbs: 4,
  fat: 9,
};

// Default auto-split (proportion of calorie target).
export const DEFAULT_SPLIT: Record<Macro, number> = {
  protein: 0.3,
  carbs: 0.4,
  fat: 0.3,
};

export type MacroGoal =
  | { kind: "auto"; g: number }
  | { kind: "custom"; g: number }
  | { kind: "off" };

export function isMacroMode(s: string | null | undefined): s is MacroMode {
  return s != null && (MACRO_MODES as readonly string[]).includes(s);
}

// Compute one macro's goal. `calorieGoal` is the daily target in kcal.
export function computeMacroGoal(
  macro: Macro,
  mode: MacroMode,
  customG: number | null,
  calorieGoal: number
): MacroGoal {
  if (mode === "off") return { kind: "off" };
  if (mode === "custom" && customG != null && customG >= 0) {
    return { kind: "custom", g: customG };
  }
  return {
    kind: "auto",
    g: Math.round((calorieGoal * DEFAULT_SPLIT[macro]) / KCAL_PER_G[macro]),
  };
}

// All three at once — what the dashboard / friends list both need.
export type MacroGoals = Record<Macro, MacroGoal>;

export function computeMacroGoals(
  calorieGoal: number,
  profile: {
    proteinGoalMode: string;
    proteinGoalG: number | null;
    carbsGoalMode: string;
    carbsGoalG: number | null;
    fatGoalMode: string;
    fatGoalG: number | null;
  }
): MacroGoals {
  return {
    protein: computeMacroGoal(
      "protein",
      isMacroMode(profile.proteinGoalMode) ? profile.proteinGoalMode : "auto",
      profile.proteinGoalG,
      calorieGoal
    ),
    carbs: computeMacroGoal(
      "carbs",
      isMacroMode(profile.carbsGoalMode) ? profile.carbsGoalMode : "auto",
      profile.carbsGoalG,
      calorieGoal
    ),
    fat: computeMacroGoal(
      "fat",
      isMacroMode(profile.fatGoalMode) ? profile.fatGoalMode : "auto",
      profile.fatGoalG,
      calorieGoal
    ),
  };
}

// Auto-derived default grams for a given calorie goal — useful as a starting
// suggestion when a user switches a macro from "off"/"auto" into "custom".
export function defaultAutoGrams(
  macro: Macro,
  calorieGoal: number
): number {
  return Math.round((calorieGoal * DEFAULT_SPLIT[macro]) / KCAL_PER_G[macro]);
}
