// AI fallback for /api/foods/search. The client calls this only after
// the conventional search returns zero rows — keeping it on its own
// route means we can show a distinct "searching the web with AI…"
// indicator and we don't pay the latency on every keystroke.

import { NextResponse } from "next/server";

import { generateAiFood } from "@/lib/ai-food";
import { requireUserId } from "@/lib/session";

export async function GET(req: Request) {
  await requireUserId();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ food: null });
  }

  const food = await generateAiFood(q);
  return NextResponse.json({ food });
}
