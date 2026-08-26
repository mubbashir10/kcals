import { NextResponse } from "next/server";

import { searchFoodLadder } from "@/lib/food-search";
import { requireUserId } from "@/lib/session";

export async function GET(req: Request) {
  const userId = await requireUserId();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ foods: [] });
  }

  try {
    // The client re-groups by dataType, but the ladder's order also sets
    // the within-group sequence (e.g. local reference rows lead whole
    // foods), so it's passed through as-is.
    return NextResponse.json({ foods: await searchFoodLadder(userId, q) });
  } catch (err) {
    // Only our own database can reach here — both external sources
    // degrade to [] inside the ladder. A throw here is a real outage.
    console.error("Food search failed", err);
    return NextResponse.json(
      { error: "Search failed", foods: [] },
      { status: 502 }
    );
  }
}
