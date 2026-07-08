import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";

// Drops a device's FCM token. Called by the native bridge when it detects the
// user is signed out, so a shared device stops receiving the previous user's
// notifications. Intentionally does NOT require a session — at sign-out time
// there's no session to check — and deletes purely by the (device-secret)
// token. Worst case is a device stops getting pushes until it re-registers on
// the next signed-in launch, so it's safe to leave unauthenticated.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (token) {
    await db.pushToken.deleteMany({ where: { token } });
  }

  return NextResponse.json({ ok: true });
}
