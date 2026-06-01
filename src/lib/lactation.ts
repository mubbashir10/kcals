// Lactation (breastfeeding) energy support.
//
// Producing milk costs energy, so a nursing mother's maintenance calories
// sit above her ordinary TDEE. We model that as an additive bump to
// maintenance — handled exactly like the goal modifier: it lives on the
// Profile, applies forward (computed live, never snapshotted), and only
// matters when sex is "female".
//
// The numbers follow the IOM / NASEM Dietary Reference Intakes — the same
// dietetics source behind the app's other constants (see lib/goal.ts):
//
//   • Milk energy output (the gross cost of making the milk that leaves the
//     body) for an EXCLUSIVELY breastfeeding mother averages ~500 kcal/day
//     in the first 6 months, tapering to ~400 (6–12 mo) and ~300 (extended,
//     12 mo+) as the baby takes more solids and nurses less.
//   • The IOM additionally assumes a mother gradually mobilises the fat she
//     gained in pregnancy — worth ~170 kcal/day for the first 6 months only
//     (stores are considered depleted after that).
//
// Two "bases" let her decide what the number should mean:
//   • "maintain" → add the FULL milk cost, so maintenance genuinely holds
//     her weight steady. Any deficit then comes only from the explicit goal
//     selector. (Recommended / default.)
//   • "iom"      → subtract the fat-store offset, matching the textbook
//     recommended-intake figure, which bakes in a gentle weight loss.
//
// Partial / combo-feeding (formula + breast) produces roughly half the milk
// of exclusive nursing, so the bump halves.

export const LACTATION_STATUSES = ["none", "exclusive", "partial"] as const;
export type LactationStatus = (typeof LACTATION_STATUSES)[number];

export const LACTATION_STAGES = ["0-6mo", "6-12mo", "12mo+"] as const;
export type LactationStage = (typeof LACTATION_STAGES)[number];

export const LACTATION_BASES = ["maintain", "iom"] as const;
export type LactationBasis = (typeof LACTATION_BASES)[number];

// Gross milk energy output (kcal/day) for exclusive breastfeeding, by stage.
const MILK_KCAL: Record<LactationStage, number> = {
  "0-6mo": 500,
  "6-12mo": 400,
  "12mo+": 300,
};

// Fat-store offset (kcal/day) the IOM assumes a mother mobilises. First 6
// months only — stores are considered depleted afterwards.
const FAT_STORE_OFFSET: Record<LactationStage, number> = {
  "0-6mo": 170,
  "6-12mo": 0,
  "12mo+": 0,
};

// Partial / combo-feeding makes roughly half the milk of exclusive nursing.
const PARTIAL_FACTOR = 0.5;

// Eating below this while nursing risks tanking milk supply, so we floor a
// breastfeeding mother's daily target here regardless of her goal/deficit.
export const LACTATION_MIN_KCAL = 1800;

export function isLactationStatus(s: unknown): s is LactationStatus {
  return (LACTATION_STATUSES as readonly unknown[]).includes(s);
}

export function isLactationStage(s: unknown): s is LactationStage {
  return (LACTATION_STAGES as readonly unknown[]).includes(s);
}

export function isLactationBasis(s: unknown): s is LactationBasis {
  return (LACTATION_BASES as readonly unknown[]).includes(s);
}

// The Profile fields this module reads. Kept narrow so callers can pass a
// whole `profile` row straight in.
export type LactationInput = {
  lactationStatus: string;
  lactationStage: string | null;
  lactationBasis: string;
};

function isBreastfeeding(input: LactationInput): boolean {
  return (
    isLactationStatus(input.lactationStatus) &&
    input.lactationStatus !== "none"
  );
}

// Extra kcal/day to add to TDEE for a nursing mother. 0 when not
// breastfeeding (or sex isn't female — callers gate on that).
export function lactationKcal(input: LactationInput): number {
  if (!isBreastfeeding(input)) return 0;

  const stage = isLactationStage(input.lactationStage)
    ? input.lactationStage
    : "0-6mo";
  const basis = isLactationBasis(input.lactationBasis)
    ? input.lactationBasis
    : "maintain";

  const offset = basis === "iom" ? FAT_STORE_OFFSET[stage] : 0;
  const gross = MILK_KCAL[stage] - offset;
  const factor = input.lactationStatus === "partial" ? PARTIAL_FACTOR : 1;
  return Math.round(gross * factor);
}

// Safety floor for a nursing mother's effective calorie target — never let a
// deficit push her below the minimum that keeps milk supply up. 0 (no floor)
// when she isn't breastfeeding.
export function lactationFloor(input: LactationInput): number {
  return isBreastfeeding(input) ? LACTATION_MIN_KCAL : 0;
}

export function lactationStageLabel(stage: LactationStage): string {
  switch (stage) {
    case "0-6mo":
      return "0–6 months";
    case "6-12mo":
      return "6–12 months";
    case "12mo+":
      return "12+ months";
  }
}
