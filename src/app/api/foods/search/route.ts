import { NextResponse } from "next/server";

import { searchFoods } from "@/lib/usda";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ foods: [] });
  }

  try {
    const foods = await searchFoods(q, { pageSize: 20 });
    return NextResponse.json({ foods });
  } catch (err) {
    console.error("USDA search failed", err);
    return NextResponse.json(
      { error: "Search failed", foods: [] },
      { status: 502 }
    );
  }
}
