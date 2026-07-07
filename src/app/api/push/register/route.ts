import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

// Called by the native bridge once the device has an FCM token and the user is
// signed in. Keyed by the token itself, so re-registering upserts (and
// re-points the token if the same device signed into a different account).
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { token?: unknown; platform?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "missing token" }, { status: 400 });
  }
  const platform =
    typeof body.platform === "string" ? body.platform : "android";

  await db.pushToken.upsert({
    where: { token },
    create: { token, userId: session.user.id, platform },
    update: { userId: session.user.id, platform },
  });

  return NextResponse.json({ ok: true });
}
