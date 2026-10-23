import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/lib/db";

// The user an MCP tool call acts for. /api/mcp has no session cookie — its
// identity comes from a verified OAuth bearer token — so it runs each tool
// inside this scope, and requireUserId() answers from it. That lets the MCP
// tools call the very same server actions the UI does, validation, ownership
// checks and revalidation included, instead of keeping a second copy of each.
// Only /api/mcp ever enters the scope; a request from the app never sees it.
// Actions that call auth() directly bypass it and read as signed out here —
// syncTimezone, and accept/declineFriendInvite (they need the email) — so a
// tool wanting one of those has to route it through this file first.
const actingUser = new AsyncLocalStorage<string>();

export function runAsUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return actingUser.run(userId, fn);
}

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
  const scoped = actingUser.getStore();
  if (scoped) return scoped;
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
