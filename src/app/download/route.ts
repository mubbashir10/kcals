import { NextResponse } from "next/server";

// Branded, stable download URL for the Android APK. Redirects to the latest
// GitHub release asset, so bumping the app just means publishing a new release
// (the "latest" alias moves automatically) — no code change or repo bloat.
export const dynamic = "force-dynamic";

const APK_URL =
  "https://github.com/mubbashir10/kcals/releases/latest/download/kcals.apk";

export function GET() {
  return NextResponse.redirect(APK_URL);
}
