import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await db.profile.findFirst();
  const unit = profile?.units === "imperial" ? "lb" : "kg";

  // Three example rows ending today, in the user's preferred unit.
  const baseWeight = unit === "lb" ? 154.0 : 69.8;
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const fmt = (d: number) => new Date(d).toISOString().slice(0, 10);

  const csv =
    [
      "date,weight,unit",
      `${fmt(now - 2 * dayMs)},${baseWeight.toFixed(1)},${unit}`,
      `${fmt(now - 1 * dayMs)},${(baseWeight - 0.2).toFixed(1)},${unit}`,
      `${fmt(now)},${(baseWeight - 0.4).toFixed(1)},${unit}`,
    ].join("\n") + "\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="weight-template.csv"`,
    },
  });
}
