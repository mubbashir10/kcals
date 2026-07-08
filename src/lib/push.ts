// Server-only FCM sender for the native Android app. No-ops gracefully when
// push isn't configured (no FIREBASE_SERVICE_ACCOUNT), so callers can fire it
// unconditionally without guarding.

import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

import { db } from "@/lib/db";

let cachedApp: App | null = null;

// Lazily init the Firebase Admin app from the service-account JSON in env.
// Returns null when unconfigured or misconfigured — push then silently no-ops.
function adminApp(): App | null {
  if (cachedApp) return cachedApp;
  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0];
    return cachedApp;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    console.error("[push] FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
  cachedApp = initializeApp({
    // `cert` expects the snake_case service-account shape as-is.
    credential: cert(serviceAccount as never),
  });
  return cachedApp;
}

export type PushPayload = {
  title: string;
  body: string;
  /** In-app path to open when the notification is tapped, e.g. "/friends". */
  url?: string;
};

// Send a notification to every device the user has registered. Prunes tokens
// FCM reports as dead so the table stays clean. Never throws — logs and moves
// on, because a failed push must never break the action that triggered it.
export async function sendPush(
  userId: string,
  payload: PushPayload
): Promise<void> {
  const app = adminApp();
  if (!app) return;

  try {
    const rows = await db.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (rows.length === 0) return;
    const tokens = rows.map((r) => r.token);

    const res = await getMessaging(app).sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.url ? { url: payload.url } : undefined,
      android: { priority: "high" },
    });

    const stale: string[] = [];
    res.responses.forEach((r, i) => {
      const code = r.success ? null : r.error?.code;
      // Only prune tokens FCM says are genuinely dead. `invalid-argument` is
      // deliberately excluded — FCM also returns it for a malformed payload,
      // which would otherwise wipe every one of this user's registrations.
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        stale.push(tokens[i]);
      }
    });
    if (stale.length > 0) {
      await db.pushToken
        .deleteMany({ where: { token: { in: stale } } })
        .catch(() => {});
    }
  } catch (err) {
    console.error("[push] sendPush failed", err);
  }
}
