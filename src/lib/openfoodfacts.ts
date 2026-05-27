// Open Food Facts client. Server-side only.
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
//
// OFF is a crowdsourced packaged-food database with strong coverage of
// regional brands (incl. Pakistan/India) that USDA misses entirely.

import { unstable_cache } from "next/cache";

import type { UsdaFood } from "./usda";

// Note: OFF's v2 /api/v2/search ignores `search_terms` and returns popular
// products regardless of the query. The legacy /cgi/search.pl endpoint is
// the one that actually does relevance-based text search.
const SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";

// OFF asks API consumers to identify themselves with a descriptive UA.
const USER_AGENT = "kcals/1.0 (https://kcals.app)";

// Synthetic-id range for OFF results. Must not collide with Custom foods
// (which use -CustomFood.id, i.e. small negatives starting at -1).
// Anything below this floor is OFF; above it (and < 0) is Custom.
const OFF_ID_FLOOR = -1_000_000_000;

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
};

type OffSearchResponse = {
  products?: OffProduct[];
  count?: number;
};

function num(v: number | string | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// Turn a barcode (string of digits) into a stable negative int safely below
// OFF_ID_FLOOR, so React keys are unique and ids never clash with Custom.
function syntheticIdFromBarcode(code: string | undefined, fallback: number): number {
  const digits = (code ?? "").replace(/\D/g, "");
  if (!digits) return OFF_ID_FLOOR - fallback;
  // Fold to 9 digits (well within int32) so we stay below the floor.
  const folded = parseInt(digits.slice(-9), 10) || fallback;
  return OFF_ID_FLOOR - folded;
}

// OFF responses are slow and change rarely; cache for 1 hour keyed on
// (query, pageSize) so popular queries don't re-hit OFF on every search.
export const searchOpenFoodFacts = unstable_cache(
  searchOpenFoodFactsUncached,
  ["off-search"],
  { revalidate: 3600, tags: ["off-search"] }
);

async function searchOpenFoodFactsUncached(
  query: string,
  { pageSize = 15 }: { pageSize?: number } = {}
): Promise<UsdaFood[]> {
  if (!query.trim()) return [];

  const url = new URL(SEARCH_URL);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(pageSize));
  url.searchParams.set(
    "fields",
    [
      "code",
      "product_name",
      "product_name_en",
      "generic_name",
      "brands",
      "serving_size",
      "serving_quantity",
      "nutriments",
    ].join(",")
  );

  let data: OffSearchResponse;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`OFF search error ${res.status}`);
    }
    data = (await res.json()) as OffSearchResponse;
  } catch (err) {
    // OFF can be flaky — never let it take down the whole search.
    console.error("Open Food Facts search failed", err);
    return [];
  }

  const products = data.products ?? [];

  return products
    .map((p, i): UsdaFood | null => {
      const n = p.nutriments ?? {};

      // OFF stores kcal under "energy-kcal_100g". Some entries only have
      // kJ ("energy_100g" in kJ) — fall back to that, converted.
      let kcal = num(n["energy-kcal_100g"]);
      if (!kcal) {
        const kj = num(n["energy_100g"]);
        if (kj > 0) kcal = kj / 4.184;
      }

      if (!kcal || kcal <= 0 || kcal > 900) return null;

      const name =
        p.product_name?.trim() ||
        p.product_name_en?.trim() ||
        p.generic_name?.trim() ||
        "";
      if (!name) return null;

      const servingG = (() => {
        const q = num(p.serving_quantity);
        return q > 0 ? q : null;
      })();

      return {
        fdcId: syntheticIdFromBarcode(p.code, i + 1),
        name,
        brand: p.brands?.split(",")[0]?.trim() || null,
        dataType: "OpenFoodFacts",
        per100g: {
          kcal,
          proteinG: num(n["proteins_100g"]),
          carbsG: num(n["carbohydrates_100g"]),
          fatG: num(n["fat_100g"]),
        },
        servingSizeG: servingG,
        servingLabel: p.serving_size?.trim() || null,
      };
    })
    .filter((f): f is UsdaFood => f !== null);
}
