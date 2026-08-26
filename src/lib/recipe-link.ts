// A diary row may only link back to the user's OWN recipe.
//
// A friend's recipe is logged as a snapshot — the nutrients stand alone,
// but Food.recipeId stays null, so a crafted request can't attach a row to
// someone else's Recipe.foods. Every write path that accepts a recipeId
// from a client filters it through here, so the rule has one home.

import type { Prisma } from "@/generated/prisma/client";

type RecipeClient = Pick<Prisma.TransactionClient, "recipe">;

/** Which of `ids` this user actually owns. Nulls and duplicates are fine;
 *  an empty ask costs no query. */
export async function ownedRecipeIds(
  client: RecipeClient,
  userId: string,
  ids: (number | null | undefined)[]
): Promise<Set<number>> {
  const wanted = Array.from(
    new Set(ids.filter((id): id is number => id != null))
  );
  if (wanted.length === 0) return new Set();

  const rows = await client.recipe.findMany({
    where: { id: { in: wanted }, userId },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}
