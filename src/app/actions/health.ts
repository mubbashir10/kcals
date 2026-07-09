"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/**
 * Turn the native Health Connect integration on or off. The Android shell reads
 * this before it touches Health Connect, so "off" stops the permission prompt
 * as well as the sync. Days already synced keep their numbers — turning it back
 * on backfills them.
 */
export async function setHealthSync(enabled: boolean) {
  const userId = await requireUserId();
  await db.profile.update({ where: { userId }, data: { healthSync: enabled } });
  revalidatePath("/settings");
}
