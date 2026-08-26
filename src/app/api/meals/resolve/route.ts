// Step 2 of free-form meal logging: bind one parsed item to a real food.
//
// One item per request, fired in parallel by the client, so a slow lookup
// (USDA, or the AI fallback) holds up its own row and nothing else.

import { NextResponse } from "next/server";

import {
  matchParsedItem,
  normalizeParsedItem,
  ParsedItemSchema,
} from "@/lib/ai-meal";
import { requireUserId } from "@/lib/session";

export async function POST(req: Request) {
  const userId = await requireUserId();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Parsed through the schema the parser itself emits, so the caps and
  // defaults are stated once rather than restated at the boundary.
  const parsed = ParsedItemSchema.safeParse((body as { item?: unknown })?.item);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const item = normalizeParsedItem(parsed.data);

  try {
    return NextResponse.json(await matchParsedItem(userId, item));
  } catch (err) {
    console.error("[meals/resolve] failed", { query: item.query }, err);
    // The row is still usable — the client renders it unmatched and the
    // user picks a food by hand.
    return NextResponse.json({ candidates: [], matchIndex: null, ai: null });
  }
}
