// Display helpers for food/recipe rows. UI-only — no DB access.

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function dataTypeLabel(t: string): string {
  if (t === "Branded") return "Branded";
  if (t === "OpenFoodFacts") return "Branded";
  if (t === "Foundation") return "Whole food";
  if (t === "SR Legacy") return "Reference";
  if (t === "Reference") return "Reference";
  if (t === "Custom") return "Community";
  if (t === "AI") return "AI estimate";
  if (t === "Recipe") return "Recipe";
  return t;
}

export function formatGrams(n: number): string {
  return String(Math.round(n));
}

// Up to 2 decimals, trailing zeros trimmed: 1.5, 0.63, 80
export function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 100) / 100);
}

// "1 paratha" → "paratha"; "1 scoop (30g protein)" → "scoop";
// falls back to the raw label if nothing strippable is found.
export function extractUnitName(label: string): string {
  const stripped = label
    .replace(/^\s*1\s+/, "")
    .replace(/\s*\(.+\)\s*$/, "")
    .trim();
  return stripped.length > 0 ? stripped : label;
}
