import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { upsertActivity } from "@/app/actions/activity";

// Native-app Health Connect sync. The Android shell reads today's de-duped
// steps + active calories from Health Connect in NATIVE Kotlin (no WebView /
// JS bridge — that path was unreliable) and POSTs them here with the WebView's
// kcals.app session cookie. We write today's ActivityLog exactly like the old
// in-app sync did: prefer the wearable's active-calorie figure (override mode =
// the TDEE input), else fall back to steps (estimate mode).
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { activeKcal?: unknown; steps?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const activeKcal = num(body.activeKcal);
  const steps = num(body.steps);

  if (activeKcal != null && activeKcal > 0) {
    await upsertActivity(null, { mode: "override", wearableKcal: activeKcal });
    return NextResponse.json({ ok: true, mode: "override", activeKcal });
  }
  if (steps != null && steps > 0) {
    await upsertActivity(null, { mode: "estimate", steps });
    return NextResponse.json({ ok: true, mode: "estimate", steps });
  }
  return NextResponse.json({ ok: true, synced: false });
}
