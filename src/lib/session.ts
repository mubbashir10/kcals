import { redirect } from "next/navigation";

import { auth } from "@/auth";

/**
 * Returns the signed-in user's id, redirecting to /signin if none.
 * Use in server components, server actions, and route handlers that
 * must have a user.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user.id;
}

/** Returns the full session, or null if not signed in. */
export async function getSession() {
  return await auth();
}
