import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { searchOpenFoodFacts } from "@/lib/openfoodfacts";
import { requireUserId } from "@/lib/session";
import { searchFoods, type UsdaFood } from "@/lib/usda";

export async function GET(req: Request) {
  await requireUserId();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ foods: [] });
  }

  try {
    // Custom foods (community-contributed) + USDA + Open Food Facts in parallel.
    // OFF fills the gap for regional packaged brands (e.g. Dawn, Olper's) that
    // USDA doesn't carry.
    const [usdaFoods, customFoods, offFoods] = await Promise.all([
      searchFoods(q, { pageSize: 20 }),
      db.customFood.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      searchOpenFoodFacts(q, { pageSize: 15 }),
    ]);

    // Map custom foods into the same shape as a USDA result so the UI
    // renders them with a single rowtype. We use negative fdcId so they
    // never collide with real USDA ids.
    const customAsResults: UsdaFood[] = customFoods.map((c) => ({
      fdcId: -c.id,
      name: c.name,
      brand: c.brand,
      dataType: "Custom",
      per100g: {
        kcal: c.kcal,
        proteinG: c.proteinG ?? 0,
        carbsG: c.carbsG ?? 0,
        fatG: c.fatG ?? 0,
      },
      servingSizeG: c.servingSizeG,
      servingLabel: c.servingLabel,
      createdAtIso: c.createdAt.toISOString(),
    }));

    // Community entries first (most relevant for local context), then USDA
    // (best for whole foods), then OFF (packaged/branded long tail).
    return NextResponse.json({
      foods: [...customAsResults, ...usdaFoods, ...offFoods],
    });
  } catch (err) {
    console.error("Food search failed", err);
    return NextResponse.json(
      { error: "Search failed", foods: [] },
      { status: 502 }
    );
  }
}
