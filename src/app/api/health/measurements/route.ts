import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import {
  importMeasurements,
  measurementState,
  type MeasurementImport,
} from "@/lib/health-measurements";
import { finiteNumberOrNull } from "@/lib/utils";

// Native-app body-measurement sync (weight, height, body fat). Companion to
// /api/health/sync (steps + active calories): the Android shell calls GET for
// the full desired Health Connect state and mirrors it there, then POSTs back
// whatever OTHER apps wrote so kcals can import it. All the policy lives in
// src/lib/health-measurements.ts; this route only authenticates and parses.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await measurementState(userId));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const data =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? parseImport(body)
      : null;
  if (data == null) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    ...(await importMeasurements(userId, data)),
  });
}

// Malformed entries are dropped rather than rejected — the values themselves
// are validated (ranges, timestamps, dedup) in importMeasurements.
function parseImport(raw: object): MeasurementImport {
  const body = raw as { weights?: unknown; height?: unknown; bodyFat?: unknown };

  const weights = Array.isArray(body.weights)
    ? body.weights.flatMap((entry) => {
        const m = parseMeasurement(entry, "kg");
        if (!m) return [];
        const source = (entry as Record<string, unknown>).source;
        return [
          {
            hcId: m.hcId,
            kg: m.value,
            epochMs: m.epochMs,
            source: typeof source === "string" ? source : null,
          },
        ];
      })
    : [];

  const height = parseMeasurement(body.height, "cm");
  const bodyFat = parseMeasurement(body.bodyFat, "pct");
  return {
    weights,
    height: height && { hcId: height.hcId, cm: height.value, epochMs: height.epochMs },
    bodyFat: bodyFat && { hcId: bodyFat.hcId, pct: bodyFat.value, epochMs: bodyFat.epochMs },
  };
}

function parseMeasurement(
  entry: unknown,
  valueKey: "kg" | "cm" | "pct"
): { hcId: string; value: number; epochMs: number } | null {
  if (typeof entry !== "object" || entry === null) return null;
  const record = entry as Record<string, unknown>;
  const value = finiteNumberOrNull(record[valueKey]);
  const epochMs = finiteNumberOrNull(record.epochMs);
  if (typeof record.hcId !== "string" || value == null || epochMs == null) {
    return null;
  }
  return { hcId: record.hcId, value, epochMs };
}
