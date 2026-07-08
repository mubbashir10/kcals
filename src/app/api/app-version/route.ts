import { NextResponse } from "next/server";

import { LATEST_ANDROID } from "@/lib/app-version";

// Latest published Android APK version, for the in-app update check. Public
// (the native app reads it on launch, signed in or not).
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(LATEST_ANDROID, {
    headers: { "cache-control": "no-store" },
  });
}
