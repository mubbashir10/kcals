import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import {
  healthSyncEnabled,
  syncHealthDays,
  type HealthDay,
} from "@/lib/health-sync";

// Native-app Health Connect sync. The Android shell reads the last week of
// de-duped per-day steps + active calories from Health Connect in NATIVE Kotlin
// (no WebView / JS bridge — that path was unreliable) and POSTs them here with
// the WebView's kcals.app session cookie.
//
// Body: { days: [{ dayKey: "YYYY-MM-DD", steps, activeKcal }, ...] }
// Older APKs post the flat { steps, activeKcal } shape, which means "today".
//
// GET reports whether the user has the integration switched on. The shell calls
// it before reading Health Connect, so "off" suppresses the permission prompt
// too — and syncHealthDays re-checks, so a stale shell can't write anyway.
export const dynamic = "force-dynamic";

const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ enabled: await healthSyncEnabled(userId) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // `null` and primitives parse fine as JSON, so check the shape, not just that
  // parsing succeeded.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const days =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? parseDays(body)
      : null;
  if (days == null) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...(await syncHealthDays(userId, days)) });
}

// `null` means the body was malformed. Entries with an unusable dayKey are
// dropped here; syncHealthDays validates the key's shape and window.
function parseDays(raw: object): HealthDay[] | null {
  const body = raw as { days?: unknown; activeKcal?: unknown; steps?: unknown };

  // Legacy single-day shape — `null` dayKey resolves to today server-side.
  if (body.days === undefined) {
    return [{ dayKey: null, steps: num(body.steps), activeKcal: num(body.activeKcal) }];
  }

  if (!Array.isArray(body.days)) return null;
  return body.days.flatMap((entry): HealthDay[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { dayKey, steps, activeKcal, source } = entry as Record<string, unknown>;
    if (typeof dayKey !== "string") return [];
    return [
      {
        dayKey,
        steps: num(steps),
        activeKcal: num(activeKcal),
        source: typeof source === "string" ? source : null,
      },
    ];
  });
}
