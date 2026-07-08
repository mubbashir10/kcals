import { NextResponse, type NextRequest } from "next/server";

// TEMPORARY exploration endpoint: the native HealthProbe POSTs what it read from
// Health Connect here so we can inspect it in the server logs (release-build
// WebView console logs don't reach logcat). Remove with the probe once the real
// Health Connect sync is built.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  console.log("[HC-DEBUG]", JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
