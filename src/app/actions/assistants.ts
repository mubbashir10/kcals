"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

// Disconnect an AI assistant connected over MCP. Deleting the grant kills its
// access and refresh tokens together, so it's out on its very next call and
// can only come back through the consent screen.
export async function disconnectAssistant(grantId: string) {
  const userId = await requireUserId();
  await db.oAuthGrant.deleteMany({ where: { id: grantId, userId } });
  revalidatePath("/settings");
}
