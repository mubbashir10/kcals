// Helpers for the friends feature. Server-only (touches the DB).

import { db } from "@/lib/db";
import { loadDailyStats } from "@/lib/daily-stats";

// Lowercased canonical email — same shape Auth.js stores. We always compare
// emails case-insensitively because that's how Google delivers them anyway.
function normEmail(e: string): string {
  return e.trim().toLowerCase();
}

// Look up the User ids that the given user is friends with. Friendships
// are stored canonically (userAId < userBId), so we check both sides.
export async function friendIdsOf(userId: string): Promise<string[]> {
  const rows = await db.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  return rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const [userAId, userBId] = a < b ? [a, b] : [b, a];
  const row = await db.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    select: { id: true },
  });
  return Boolean(row);
}

// Compact summary used in the home FriendsStrip and the /friends list.
export type FriendSummary = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  hasProfile: boolean;
  consumedKcal: number;
  goalKcal: number | null;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFat: number;
};

export async function listFriendSummaries(
  userId: string,
  now: Date = new Date()
): Promise<FriendSummary[]> {
  const friendIds = await friendIdsOf(userId);
  if (friendIds.length === 0) return [];

  const users = await db.user.findMany({
    where: { id: { in: friendIds } },
    select: { id: true, name: true, email: true, image: true },
    orderBy: { name: "asc" },
  });

  // Compute each friend's day in parallel. readOnly skips the snapshot
  // upsert — we're viewing a friend's row, not theirs to touch.
  return await Promise.all(
    users.map(async (u) => {
      const stats = await loadDailyStats(u.id, now, { readOnly: true });
      if (!stats) {
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          image: u.image,
          hasProfile: false,
          consumedKcal: 0,
          goalKcal: null,
          consumedProtein: 0,
          consumedCarbs: 0,
          consumedFat: 0,
        };
      }
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        hasProfile: true,
        consumedKcal: Math.round(stats.consumed.kcal),
        goalKcal: stats.calorieGoal,
        consumedProtein: Math.round(stats.consumed.protein),
        consumedCarbs: Math.round(stats.consumed.carbs),
        consumedFat: Math.round(stats.consumed.fat),
      };
    })
  );
}

// Invites addressed to a signed-in user (by email match) that haven't been
// accepted or expired yet. Used for the home-page banner and /friends page.
export async function pendingInvitesForUser(email: string) {
  const e = normEmail(email);
  return db.friendInvite.findMany({
    where: {
      email: e,
      acceptedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      inviter: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Pending invites the user has sent and not yet been accepted.
export async function pendingInvitesFromUser(userId: string) {
  return db.friendInvite.findMany({
    where: {
      inviterId: userId,
      acceptedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
}

export { normEmail };
