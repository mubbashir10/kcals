"use client";

import { useMemo, useState } from "react";

import { SearchInput } from "@/components/search-input";
import { fieldsMatch } from "@/lib/search";
import {
  RecipeListItem,
  type RecipeListItemData,
} from "@/components/recipe-list-item";

export function RecipesList({
  recipes,
  friendRecipes,
}: {
  recipes: RecipeListItemData[];
  friendRecipes: RecipeListItemData[];
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filteredOwn = useMemo(
    () =>
      q ? recipes.filter((r) => fieldsMatch(q, r.name, r.ownerName)) : recipes,
    [recipes, q]
  );
  const filteredFriends = useMemo(
    () =>
      q
        ? friendRecipes.filter((r) => fieldsMatch(q, r.name, r.ownerName))
        : friendRecipes,
    [friendRecipes, q]
  );

  const hasMatches = filteredOwn.length > 0 || filteredFriends.length > 0;

  return (
    <div className="space-y-6">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search recipes"
      />

      {!hasMatches ? (
        <p className="px-1 py-8 text-center text-sm text-muted-foreground">
          No recipes match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <div className="space-y-8">
          {filteredOwn.length > 0 && (
            <ul className="space-y-2">
              {filteredOwn.map((r) => (
                <RecipeListItem key={r.id} recipe={r} />
              ))}
            </ul>
          )}

          {filteredFriends.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Friends&rsquo; recipes
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <ul className="space-y-2">
                {filteredFriends.map((r) => (
                  <RecipeListItem key={`f-${r.id}`} recipe={r} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
