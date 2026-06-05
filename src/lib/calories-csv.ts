// Small CSV parser for the calorie-import dialog. Pairs with the template
// route at /api/calories/template/route.ts (which writes the same shape this
// reads). Import is deliberately coarse — one daily total per row — because a
// bulk import from another tracker has no food behind the numbers. Each row
// becomes one "Imported" meal holding a single quick-add (see
// importCalorieDays). Export is the rich, food-level counterpart.

export type CaloriesCsvRow = {
  date: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type ParseCaloriesCsvResult = {
  rows: CaloriesCsvRow[];
  invalidCount: number;
};

// A macro cell is optional: blank, missing, or unparseable all mean "unknown",
// which we record as 0 (we don't know them, and 0 is honest). Negatives are
// nonsense, so they collapse to 0 too.
function parseMacroCell(cell: string | undefined): number {
  if (cell == null || cell.trim().length === 0) return 0;
  const n = parseFloat(cell);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Accepts:
//   date,kcal                          (macros default to 0)
//   date,kcal,protein_g,carbs_g,fat_g  (any trailing macro may be blank)
// First row may be a header (auto-detected). Quotes are not supported — the
// import shape is all numbers and a date, so it never needs them.
export function parseCaloriesCsv(text: string): ParseCaloriesCsvResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length === 0) return { rows: [], invalidCount: 0 };

  // Detect header: any non-numeric in the kcal column on the first row.
  const first = lines[0].split(",").map((c) => c.trim());
  const headerLooksLikeHeader =
    first.length >= 2 &&
    (first[0].toLowerCase() === "date" || isNaN(parseFloat(first[1])));

  const dataLines = headerLooksLikeHeader ? lines.slice(1) : lines;

  const rows: CaloriesCsvRow[] = [];
  let invalidCount = 0;

  for (const line of dataLines) {
    const cells = line.split(",").map((c) => c.trim());
    if (cells.length < 2) {
      invalidCount++;
      continue;
    }
    const date = cells[0];
    const kcal = parseFloat(cells[1]);

    const parsedDate = new Date(date);
    if (
      isNaN(parsedDate.getTime()) ||
      !Number.isFinite(kcal) ||
      kcal <= 0 ||
      kcal > 100000
    ) {
      invalidCount++;
      continue;
    }

    rows.push({
      date,
      kcal,
      proteinG: parseMacroCell(cells[2]),
      carbsG: parseMacroCell(cells[3]),
      fatG: parseMacroCell(cells[4]),
    });
  }

  return { rows, invalidCount };
}
