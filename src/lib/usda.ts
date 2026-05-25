// USDA FoodData Central client. Server-side only.
// Docs: https://fdc.nal.usda.gov/api-guide.html

const BASE = "https://api.nal.usda.gov/fdc/v1";

// Legacy "Nutrient Number" codes — used by the /foods abridged endpoint.
const NUM = {
  // SR Legacy reports energy under "208". Foundation foods don't always
  // — they use Atwater Specific (958) or Atwater General (957) factors.
  // Try them in order of precision.
  ENERGY_KCAL: ["208", "958", "957"],
  PROTEIN: "203",
  FAT: "204",
  CARBS: "205",
} as const;

export type UsdaFood = {
  fdcId: number;
  name: string;
  brand: string | null;
  dataType: string;
  /** Nutrients per 100g of the raw food. */
  per100g: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  /** Suggested serving size in grams, if the entry provides one (mainly Branded foods). */
  servingSizeG: number | null;
  /** Only set for community-contributed (dataType "Custom") entries. */
  createdAtIso?: string;
  servingLabel: string | null;
};

type FdcSearchFood = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  dataType: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
};

type FdcSearchResponse = { foods: FdcSearchFood[] };

type FdcAbridgedFood = {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: Array<{
    number: string;
    name?: string;
    amount?: number;
    unitName?: string;
  }>;
};

function pickNutrient(
  nutrients: FdcAbridgedFood["foodNutrients"],
  numbers: string | readonly string[]
): number {
  const list = Array.isArray(numbers) ? numbers : [numbers as string];
  for (const n of list) {
    const match = nutrients.find((x) => x.number === n);
    if (match?.amount != null && match.amount > 0) return match.amount;
  }
  return 0;
}

function gramsFromServing(
  size: number | undefined,
  unit: string | undefined
): number | null {
  if (!size || !unit) return null;
  const u = unit.toLowerCase();
  if (u === "g" || u === "gram" || u === "grams") return size;
  if (u === "mg") return size / 1000;
  if (u === "kg") return size * 1000;
  return null;
}

async function fdcSearch(
  query: string,
  pageSize: number,
  apiKey: string
): Promise<FdcSearchResponse> {
  const res = await fetch(`${BASE}/foods/search?api_key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      pageSize,
      requireAllWords: true,
      dataType: ["Foundation", "SR Legacy", "Branded"],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`USDA search error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fdcAbridged(
  fdcIds: number[],
  apiKey: string
): Promise<FdcAbridgedFood[]> {
  if (fdcIds.length === 0) return [];
  const url = new URL(`${BASE}/foods`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("fdcIds", fdcIds.join(","));
  url.searchParams.set("format", "abridged");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`USDA bulk error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// USDA's relevance ranking buries plain entries under derivatives.
// This rescore bumps canonical whole-food matches to the top.
const PREP_PENALTIES = [
  // baked / packaged sweets
  "babyfood", "baby food", "juice", "strudel", "croissant", "pie", "fritter",
  "filling", "sauce", "jelly", "jam", "candy", "cookie", "pastry", "tart",
  "cake", "muffin", "bar", "syrup", "puree", "snack",
  // processed protein cuts/forms
  "tender", "tenders", "roll", "patty", "patties", "nugget", "nuggets",
  "wing", "wings", "strip", "strips", "ball", "balls", "loaf",
  // prep methods
  "breaded", "battered", "fried", "smoked", "marinated", "glazed", "cured",
  // deli / preserved
  "deli", "lunchmeat", "lunch meat", "rotisserie", "frankfurter", "sausage",
  "canned", "candied", "salted",
] as const;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[,\-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreResult(
  qTokens: string[],
  food: FdcSearchFood,
  originalIndex: number
): number {
  const q = qTokens.join(" ");
  const name = normalize(food.description);
  const firstToken = name.split(" ")[0] ?? "";

  let score = 0;

  // Strongest: the first word of the description matches the query
  if (
    firstToken === q ||
    firstToken === q + "s" ||
    firstToken + "s" === q
  ) {
    score += 100;
  } else if (
    name.startsWith(q + " ") ||
    name.startsWith(q + "s ") ||
    name === q ||
    name === q + "s"
  ) {
    score += 70;
  }

  // Each query word found somewhere
  for (const w of qTokens) {
    if (name.includes(w)) score += 5;
  }

  // Penalize compound/prepared forms unless the user explicitly asked for them
  for (const kw of PREP_PENALTIES) {
    if (
      new RegExp(`\\b${kw}\\b`).test(name) &&
      !qTokens.some((t) => kw === t || kw.startsWith(t))
    ) {
      score -= 30;
      break;
    }
  }

  // Reward whole-food descriptors
  if (/\braw\b/.test(name)) score += 8;
  if (/\bfresh\b/.test(name)) score += 4;

  // Data type preference (Foundation > SR Legacy > Branded)
  if (food.dataType === "Foundation") score += 10;
  else if (food.dataType === "SR Legacy") score += 4;

  // Shorter = more canonical
  score -= Math.min(name.length / 10, 8);

  // Tiebreaker: USDA's own ranking, mild influence
  score -= originalIndex * 0.05;

  return score;
}

export async function searchFoods(
  query: string,
  { pageSize = 25 }: { pageSize?: number } = {}
): Promise<UsdaFood[]> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) throw new Error("USDA_API_KEY is not set");
  if (!query.trim()) return [];

  // Pull a wider pool so the local re-rank has something to work with.
  const POOL_SIZE = 50;
  const search = await fdcSearch(query, POOL_SIZE, apiKey);
  if (search.foods.length === 0) return [];

  // Local re-rank against the user's query, then take the top N.
  const qTokens = query.toLowerCase().trim().split(/\s+/);
  const ranked = search.foods
    .map((f, i) => ({ food: f, score: scoreResult(qTokens, f, i) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, pageSize)
    .map((r) => r.food);

  // Fetch detailed nutrients only for the winners.
  const details = await fdcAbridged(
    ranked.map((f) => f.fdcId),
    apiKey
  );
  const byId = new Map(details.map((d) => [d.fdcId, d]));

  return ranked
    .map((f) => {
      const detail = byId.get(f.fdcId);
      const nutrients = detail?.foodNutrients ?? [];

      const isBranded = f.dataType?.toLowerCase().includes("branded");
      const servingG = gramsFromServing(f.servingSize, f.servingSizeUnit);

      const raw = {
        kcal: pickNutrient(nutrients, NUM.ENERGY_KCAL),
        proteinG: pickNutrient(nutrients, NUM.PROTEIN),
        carbsG: pickNutrient(nutrients, NUM.CARBS),
        fatG: pickNutrient(nutrients, NUM.FAT),
      };

      const per100g =
        isBranded && servingG && servingG > 0
          ? {
              kcal: (raw.kcal / servingG) * 100,
              proteinG: (raw.proteinG / servingG) * 100,
              carbsG: (raw.carbsG / servingG) * 100,
              fatG: (raw.fatG / servingG) * 100,
            }
          : raw;

      return {
        fdcId: f.fdcId,
        name: f.description,
        brand: f.brandOwner ?? f.brandName ?? null,
        dataType: f.dataType,
        per100g,
        servingSizeG: servingG,
        servingLabel: f.householdServingFullText ?? null,
      };
    })
    // Drop entries with missing or physically-impossible energy values.
    // Real food caps around 900 kcal/100g (pure fat ≈ 884).
    .filter((f) => f.per100g.kcal > 0 && f.per100g.kcal <= 900);
}
