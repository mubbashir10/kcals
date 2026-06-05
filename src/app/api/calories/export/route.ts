import { db } from "@/lib/db";
import { dayKeyInTz, formatTimeInTz } from "@/lib/clock";
import { getProfileTimezone } from "@/lib/clock.server";
import { requireUserId } from "@/lib/session";
import { round1 } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Quote a cell when it contains a comma, quote, or newline (food and brand
// names can have any of these), doubling embedded quotes per RFC 4180.
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Rich, food-level export — one row per logged food, the full fidelity we have
// on disk. The counterpart import (date,kcal,...) is deliberately coarse; the
// two don't round-trip, and that's by design.
export async function GET() {
  const userId = await requireUserId();
  const tz = await getProfileTimezone(userId);

  const meals = await db.meal.findMany({
    where: { userId },
    orderBy: { loggedAt: "desc" },
    select: {
      name: true,
      foods: {
        orderBy: { loggedAt: "asc" },
        select: {
          name: true,
          brand: true,
          grams: true,
          kcal: true,
          proteinG: true,
          carbsG: true,
          fatG: true,
          loggedAt: true,
        },
      },
    },
  });

  const rows: string[] = [];
  for (const meal of meals) {
    for (const f of meal.foods) {
      rows.push(
        [
          dayKeyInTz(tz, f.loggedAt),
          csvCell(formatTimeInTz(f.loggedAt, tz)),
          csvCell(meal.name ?? ""),
          csvCell(f.name),
          csvCell(f.brand ?? ""),
          round1(f.grams),
          round1(f.kcal),
          round1(f.proteinG),
          round1(f.carbsG),
          round1(f.fatG),
        ].join(",")
      );
    }
  }

  const header = "date,time,meal,food,brand,grams,kcal,protein_g,carbs_g,fat_g";
  const csv = [header, ...rows].join("\n") + "\n";
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calories-${today}.csv"`,
    },
  });
}
