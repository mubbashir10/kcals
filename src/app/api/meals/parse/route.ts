// Step 1 of free-form meal logging: read the text.
//
// A route handler rather than a Server Action because /resolve, which the
// client fires once per parsed item, has to run in parallel — Server
// Actions are queued one at a time per client. The two stay together.

import { NextResponse } from "next/server";

import { listMealsOnDay } from "@/app/actions/meals";
import { dayKeyInTz, isDayKey, timeInputValueInTz } from "@/lib/clock";
import { getProfileTimezone } from "@/lib/clock.server";
import { parseMealDump } from "@/lib/ai-meal";
import { requireUserId } from "@/lib/session";

export async function POST(req: Request) {
  const userId = await requireUserId();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { text, dayKey } = (body ?? {}) as { text?: unknown; dayKey?: unknown };
  if (typeof text !== "string" || text.trim().length < 3) {
    return NextResponse.json(
      { error: "Tell me what you ate first." },
      { status: 400 }
    );
  }

  const tz = await getProfileTimezone(userId);
  const day =
    typeof dayKey === "string" && isDayKey(dayKey) ? dayKey : dayKeyInTz(tz);

  // The names the parser should snap onto are exactly the ones the review
  // screen can target — the day's meals plus its unspent default-meal
  // placeholders. Same call the page makes, so the two can't disagree.
  const options = await listMealsOnDay(day);
  const knownMealNames = Array.from(
    new Set(
      options
        .map((m) => m.name?.trim())
        .filter((n): n is string => !!n)
    )
  );

  try {
    const meals = await parseMealDump(text, {
      knownMealNames,
      nowHhmm: timeInputValueInTz(new Date(), tz),
    });
    return NextResponse.json({ meals, dayKey: day });
  } catch (err) {
    console.error("[meals/parse] failed", err);
    return NextResponse.json(
      { error: "Couldn't read that. Try rewording it." },
      { status: 502 }
    );
  }
}
