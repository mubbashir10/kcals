import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import {
  healthSourceNames,
  healthSyncEnabled,
  saveHealthSources,
  syncHealthDays,
  type HealthDay,
  type HealthSourceIcon,
} from "@/lib/health-sync";
import { finiteNumberOrNull as num } from "@/lib/utils";

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

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const enabled = await healthSyncEnabled(userId);
  // The shell posts an icon only for an app missing from this list, so the
  // usual sync carries days alone.
  return NextResponse.json({
    enabled,
    sources: enabled ? await healthSourceNames(userId) : [],
  });
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
  const payload =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? body
      : null;
  const days = payload ? parseDays(payload) : null;
  if (payload == null || days == null) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // Icons are stored even when every day is refused — a hand-entered week
  // still wants its app's name and icon on the days it does sync later.
  const sources = await saveHealthSources(userId, parseSources(payload));
  return NextResponse.json({
    ok: true,
    sources,
    ...(await syncHealthDays(userId, days)),
  });
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
    const { dayKey, steps, activeKcal, liftingMin, cardioMin, source } =
      entry as Record<string, unknown>;
    if (typeof dayKey !== "string") return [];
    return [
      {
        dayKey,
        steps: num(steps),
        activeKcal: num(activeKcal),
        liftingMin: num(liftingMin),
        cardioMin: num(cardioMin),
        source: typeof source === "string" ? source : null,
      },
    ];
  });
}

// The apps behind those days, with their launcher icons. Absent on older
// shells and on any sync where the server already had every icon.
function parseSources(raw: object): HealthSourceIcon[] {
  const { sources } = raw as { sources?: unknown };
  if (!Array.isArray(sources)) return [];
  return sources.flatMap((entry): HealthSourceIcon[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { name, icon } = entry as Record<string, unknown>;
    if (typeof name !== "string" || typeof icon !== "string") return [];
    return [{ name, icon }];
  });
}
