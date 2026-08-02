// The one place a day's targets are derived from a profile:
//
//   burn (BMR + active)  →  + lactation  →  goal offset  →  floors  →  target
//                                                                      ↓
//                                                                 macro grams
//
// Callers fetch the burn differently (today reads a live profile, history a
// stored snapshot), so what's shared is the derivation, not the fetching.
//
// Goal, lactation, and macro settings live on Profile and apply FORWARD — they
// are deliberately not snapshotted per day, so a historical target reads as
// "what today's settings would have meant for that day".

import {
  computeEffectiveTarget,
  computeKcalOffset,
  isGoalPace,
  isGoalType,
  type GoalPace,
  type GoalType,
} from "@/lib/goal";
import { lactationKcal, lactationFloor, type LactationInput } from "@/lib/lactation";
import { computeMacroGoals, type MacroGoals } from "@/lib/macros";

/** The Profile columns this derivation reads — a real row satisfies it. */
export type DayEnergyProfile = LactationInput & {
  goalType: string;
  goalPace: string | null;
  trackKcal: number | null;
  proteinGoalMode: string;
  proteinGoalG: number | null;
  carbsGoalMode: string;
  carbsGoalG: number | null;
  fatGoalMode: string;
  fatGoalG: number | null;
};

export type ResolvedGoal = {
  goalType: GoalType;
  goalPace: GoalPace | null;
  /** Signed kcal/day applied to TDEE — negative for loss, positive for gain. */
  kcalOffset: number;
};

/**
 * Read the goal off a profile, falling back to maintain for unrecognized
 * values. The columns are plain strings, so every read needs this narrowing.
 */
export function resolveGoal(profile: {
  goalType: string;
  goalPace: string | null;
}): ResolvedGoal {
  const goalType: GoalType = isGoalType(profile.goalType)
    ? profile.goalType
    : "maintain";
  const goalPace: GoalPace | null = isGoalPace(profile.goalPace)
    ? profile.goalPace
    : null;
  return { goalType, goalPace, kcalOffset: computeKcalOffset(goalType, goalPace) };
}

export type DayTargets = ResolvedGoal & {
  bmrKcal: number;
  /** Total burn including the lactation bump — what "maintenance" means today. */
  tdeeKcal: number;
  /** The milk-production cost folded into `tdeeKcal` (0 when not nursing). */
  lactationKcal: number;
  /** Effective calorie target — what the ring counts down from. */
  calorieGoal: number;
  macroGoals: MacroGoals;
};

/**
 * Bind the profile-level settings once, returning a per-day function. The
 * goal, the lactation bump and its floor depend only on the profile, so a
 * 365-day history pass resolves them once rather than per row.
 */
export function dayTargetsFor(profile: DayEnergyProfile) {
  const goal = resolveGoal(profile);
  const lactation = lactationKcal(profile);
  const floor = lactationFloor(profile);

  return function targetsForDay(
    bmrKcal: number,
    /** Burn BEFORE the lactation bump — pass the raw snapshot or estimate. */
    baseTdeeKcal: number
  ): DayTargets {
    const tdeeKcal = baseTdeeKcal + lactation;
    const calorieGoal = computeEffectiveTarget(
      tdeeKcal,
      bmrKcal,
      goal.goalType,
      goal.goalPace,
      profile.trackKcal,
      floor
    );
    return {
      ...goal,
      bmrKcal,
      tdeeKcal,
      lactationKcal: lactation,
      calorieGoal,
      macroGoals: computeMacroGoals(calorieGoal, profile),
    };
  };
}

/** One day's targets. See `dayTargetsFor` when deriving many days at once. */
export function computeDayTargets({
  bmrKcal,
  baseTdeeKcal,
  profile,
}: {
  bmrKcal: number;
  baseTdeeKcal: number;
  profile: DayEnergyProfile;
}): DayTargets {
  return dayTargetsFor(profile)(bmrKcal, baseTdeeKcal);
}

/**
 * A day's total burn: what the body spends, milk included. The lactation fold
 * is the step callers most often forget, so it lives here for the surfaces
 * that need burn rather than a target (the week summary).
 */
export function dayBurnKcal(
  baseTdeeKcal: number,
  profile: LactationInput
): number {
  return baseTdeeKcal + lactationKcal(profile);
}
