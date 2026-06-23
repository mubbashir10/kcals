"use client";

import { useMemo, useState } from "react";

import { SearchInput } from "@/components/search-input";
import { fieldsMatch } from "@/lib/search";
import {
  CustomFoodListItem,
  type CustomFoodListItemData,
} from "@/components/custom-food-list-item";

export function FoodsList({ foods }: { foods: CustomFoodListItemData[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtered = useMemo(
    () => (q ? foods.filter((f) => fieldsMatch(q, f.name, f.brand)) : foods),
    [foods, q]
  );

  return (
    <div className="space-y-6">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search your foods"
      />

      {filtered.length === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-muted-foreground">
          No foods match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((f) => (
            <CustomFoodListItem key={f.id} food={f} />
          ))}
        </ul>
      )}
    </div>
  );
}
