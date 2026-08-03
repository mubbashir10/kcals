// Helpers for the friends feature. Server-only (touches the DB).

import { db } from "@/lib/db";
import { buildDailySnapshot, dayOutlook } from "@/lib/daily-snapshot";
import { dayElapsedFraction, dayKeyInTz, startOfDayInTz } from "@/lib/clock";
import { computeDayTargets } from "@/lib/day-energy";
import type { ActivityMode } from "@/lib/tdee";
import { sumBy } from "@/lib/utils";

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

// A friend's recipe, with its ingredients (for totals) and the owner's
// display name. Read-only to the viewer — logged as a snapshot, never
// linked back via Food.recipeId (which would leak the viewer's diary rows
// into the friend's Recipe.foods).
export type FriendRecipe = {
  id: number;
  name: string;
  totalWeightG: number | null;
  servings: number | null;
  createdAt: Date;
  ownerId: string;
  ownerName: string;
  ingredients: {
    grams: number;
    per100Kcal: number;
    per100ProteinG: number;
    per100CarbsG: number;
    per100FatG: number;
  }[];
};

// Recipes owned by the viewer's accepted friends. `nameTokensAnd` (when
// given) AND-matches each token against the recipe name, matching the
// search route's own-recipe query.
export async function friendRecipesOf(
  userId: string,
  opts: {
    nameTokensAnd?: { name: { contains: string; mode: "insensitive" } }[];
    take?: number;
  } = {}
): Promise<FriendRecipe[]> {
  const friendIds = await friendIdsOf(userId);
  if (friendIds.length === 0) return [];

  const recipes = await db.recipe.findMany({
    where: {
      userId: { in: friendIds },
      ...(opts.nameTokensAnd ? { AND: opts.nameTokensAnd } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.take,
    include: { ingredients: true },
  });
  if (recipes.length === 0) return [];

  const owners = await db.user.findMany({
    where: { id: { in: [...new Set(recipes.map((r) => r.userId))] } },
    select: { id: true, name: true, email: true },
  });
  const nameById = new Map(
    owners.map((u) => [u.id, u.name ?? u.email.split("@")[0]])
  );

  return recipes.map((r) => ({
    id: r.id,
    name: r.name,
    totalWeightG: r.totalWeightG,
    servings: r.servings,
    createdAt: r.createdAt,
    ownerId: r.userId,
    ownerName: nameById.get(r.userId) ?? "Friend",
    ingredients: r.ingredients,
  }));
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

  // Bulk-fetch instead of running loadDailyStats per friend (which was
  // ~5 queries each). Users + profiles are independent of tz, so fetch
  // them first; activity logs and meals need each friend's tz-derived
  // day boundary, so they come second.
  const [users, profiles] = await Promise.all([
    db.user.findMany({
      where: { id: { in: friendIds } },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    }),
    db.profile.findMany({ where: { userId: { in: friendIds } } }),
  ]);

  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));

  // Per-friend day boundaries. dayKey/startOfDay depend on the friend's
  // own timezone, so compute them up front.
  const todayKeyByUser = new Map<string, string>();
  let earliestStart: Date | null = null;
  for (const p of profiles) {
    const tz = p.timezone || "UTC";
    todayKeyByUser.set(p.userId, dayKeyInTz(tz, now));
    const start = startOfDayInTz(tz, now);
    if (earliestStart == null || start < earliestStart) earliestStart = start;
  }

  const dayKeys = Array.from(new Set(todayKeyByUser.values()));

  const [activityLogs, meals] = await Promise.all([
    dayKeys.length > 0
      ? db.activityLog.findMany({
          where: { userId: { in: friendIds }, dayKey: { in: dayKeys } },
        })
      : Promise.resolve([]),
    earliestStart != null
      ? db.meal.findMany({
          where: { userId: { in: friendIds }, loggedAt: { gte: earliestStart } },
          select: {
            userId: true,
            loggedAt: true,
            foods: {
              select: { kcal: true, proteinG: true, carbsG: true, fatG: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  // Index activity by (userId, dayKey) — the unique key — so each friend
  // reads only their own row for their own day.
  const activityByUserDay = new Map<string, (typeof activityLogs)[number]>();
  for (const a of activityLogs) {
    activityByUserDay.set(`${a.userId}:${a.dayKey}`, a);
  }

  return users.map((u) => {
    const profile = profileByUser.get(u.id);
    if (!profile) {
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

    const tz = profile.timezone || "UTC";
    const start = startOfDayInTz(tz, now);
    const todayKey = todayKeyByUser.get(u.id)!;
    const activity = activityByUserDay.get(`${u.id}:${todayKey}`) ?? null;

    // Recomputed from their current profile and today's row rather than read
    // off the stored snapshot, exactly as loadDailyStats does — it's their
    // today, in their timezone, so their burn has to project the same way it
    // does for them. Otherwise their ring here wouldn't match their own.
    const snapshot = buildDailySnapshot(
      profile,
      activity
        ? {
            mode: activity.mode as ActivityMode,
            steps: activity.steps,
            liftingMin: activity.liftingMin,
            cardioMin: activity.cardioMin,
            wearableKcal: activity.wearableKcal,
          }
        : null
    );
    const outlook = dayOutlook({
      ...snapshot.columns,
      elapsed: dayElapsedFraction(tz, now),
    });
    const targets = computeDayTargets({
      bmrKcal: outlook.bmrKcal,
      baseTdeeKcal: outlook.tdeeKcal,
      profile,
    });

    const todaysFoods = meals
      .filter((m) => m.userId === u.id && m.loggedAt >= start)
      .flatMap((m) => m.foods);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      hasProfile: true,
      consumedKcal: Math.round(sumBy(todaysFoods, "kcal")),
      goalKcal: targets.calorieGoal,
      consumedProtein: Math.round(sumBy(todaysFoods, "proteinG")),
      consumedCarbs: Math.round(sumBy(todaysFoods, "carbsG")),
      consumedFat: Math.round(sumBy(todaysFoods, "fatG")),
    };
  });
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
