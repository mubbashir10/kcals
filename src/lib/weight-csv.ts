// Small CSV parser for the weight-log import dialog. Pairs with the
// template route at /api/weight/template/route.ts (which writes the
// same shape this reads).

import { lbToKg } from "@/lib/bmr";

export type WeightCsvRow = { date: string; weightKg: number };

export type ParseWeightCsvResult = {
  rows: WeightCsvRow[];
  invalidCount: number;
};

// Accepts:
//   date,weight             (uses defaultUnit)
//   date,weight,unit        (unit per row: kg or lb)
// First row may be a header (auto-detected). Quotes are not supported,
// but we don't need them for this data shape.
export function parseWeightCsv(
  text: string,
  defaultUnit: "kg" | "lb"
): ParseWeightCsvResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length === 0) return { rows: [], invalidCount: 0 };

  // Detect header: any non-numeric in the weight column on the first row
  const first = lines[0].split(",").map((c) => c.trim());
  const headerLooksLikeHeader =
    first.length >= 2 &&
    (first[0].toLowerCase() === "date" || isNaN(parseFloat(first[1])));

  const dataLines = headerLooksLikeHeader ? lines.slice(1) : lines;

  const rows: WeightCsvRow[] = [];
  let invalidCount = 0;

  for (const line of dataLines) {
    const cells = line.split(",").map((c) => c.trim());
    if (cells.length < 2) {
      invalidCount++;
      continue;
    }
    const date = cells[0];
    const weight = parseFloat(cells[1]);
    const unit: "kg" | "lb" =
      cells[2]?.toLowerCase() === "lb"
        ? "lb"
        : cells[2]?.toLowerCase() === "kg"
        ? "kg"
        : defaultUnit;

    const parsedDate = new Date(date);
    if (
      isNaN(parsedDate.getTime()) ||
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      invalidCount++;
      continue;
    }
    const kg = unit === "lb" ? lbToKg(weight) : weight;
    rows.push({ date, weightKg: kg });
  }

  return { rows, invalidCount };
}
