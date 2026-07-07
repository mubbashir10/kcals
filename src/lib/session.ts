import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * Returns the full session, or null if not signed in. Wrapped in React
 * `cache()` so the layout, page, and any actions in one request share a
 * single JWT decode instead of each calling `auth()` independently.
 */
export const getSession = cache(async () => auth());

/**
 * Returns the signed-in user's id, redirecting to /signin if none.
 * Use in server components, server actions, and route handlers that
 * must have a user.
 */
export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");
  return session.user.id;
}

/**
 * Returns `{ userId, profile }` for the signed-in user, redirecting to
 * /signin if not signed in or /setup if onboarding isn't complete.
 * Use in pages that need a fully-onboarded user.
 */
export async function requireProfile() {
  const userId = await requireUserId();
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) redirect("/setup");
  return { userId, profile };
}
