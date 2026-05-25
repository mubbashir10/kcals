import { db } from "@/lib/db";
import { kgToLb } from "@/lib/bmr";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await requireUserId();
  const profile = await db.profile.findUnique({ where: { userId } });
  const unit = profile?.units === "imperial" ? "lb" : "kg";

  const logs = await db.weightLog.findMany({
    where: { userId },
    orderBy: { loggedAt: "desc" },
  });

  const rows = logs.map((l) => {
    const date = l.loggedAt.toISOString().slice(0, 10);
    const weight = unit === "lb" ? kgToLb(l.weightKg) : l.weightKg;
    return `${date},${round1(weight)},${unit}`;
  });

  const csv = ["date,weight,unit", ...rows].join("\n") + "\n";
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="weight-${today}.csv"`,
    },
  });
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
