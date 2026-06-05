import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

// The template matches the IMPORT shape (date,kcal,macros) — that's the file
// you upload. Export is a different, richer shape. Macros are optional; the
// third example row shows a kcal-only day.
export async function GET() {
  await requireUserId();

  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const fmt = (d: number) => new Date(d).toISOString().slice(0, 10);

  const csv =
    [
      "date,kcal,protein_g,carbs_g,fat_g",
      `${fmt(now - 2 * dayMs)},2100,150,180,70`,
      `${fmt(now - 1 * dayMs)},1950,140,170,65`,
      `${fmt(now)},2200`,
    ].join("\n") + "\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calories-template.csv"`,
    },
  });
}
