"use client";

import type { Nutrients } from "@/lib/nutrition";
import { useEffect, useRef, useState } from "react";

// The shape /api/foods/search returns. Recipe rows carry an extra
// `recipeId`; community-contributed rows carry `createdAtIso`. The AI
// route adds `aiModel`, `aiSources`, `aiConfidence` for in-progress
// previews before approval.
export type SearchFood = {
  fdcId: number;
  name: string;
  brand: string | null;
  dataType: string;
  per100g: Nutrients;
  servingSizeG: number | null;
  servingLabel: string | null;
  createdAtIso?: string;
  recipeId?: number;
  /** Set on a friend's recipe (read-only) — the owner's display name.
   *  Friend recipes carry no recipeId; they're logged as a snapshot. */
  ownerName?: string;
  aiModel?: string;
  aiSources?: string[];
  aiConfidence?: "low" | "medium" | "high";
};

export type UseFoodSearchOptions = {
  /** Drop the row for this recipe id. Set in the recipe builder to the
   *  recipe being edited so it can't be added as an ingredient of itself.
   *  Other recipes still surface — they're added as frozen snapshots, so
   *  there's no recursion (e.g. a gravy recipe inside a biryani recipe). */
  excludeRecipeId?: number;
};

export type UseFoodSearchState = {
  query: string;
  setQuery: (next: string) => void;
  results: SearchFood[];
  loading: boolean;
  error: string | null;
  /** Set by the AI fallback when conventional search returns empty. */
  aiResult: SearchFood | null;
  aiLoading: boolean;
};

/**
 * Debounced food search with a second-stage AI fallback. The `setQuery`
 * setter resets transient state synchronously so the UI never shows
 * stale results from a previous query while the next fetch is in flight.
 */
export function useFoodSearch(
  opts: UseFoodSearchOptions = {}
): UseFoodSearchState {
  const { excludeRecipeId } = opts;

  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<SearchFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<SearchFood | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const reqId = useRef(0);
  const aiReqId = useRef(0);

  function setQuery(next: string) {
    setQueryState(next);
    setResults([]);
    setError(null);
    setAiResult(null);
    setAiLoading(false);
    setLoading(next.trim().length >= 2);
  }

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;

    const myId = ++reqId.current;
    // AbortController cancels both the debounced fetch and the AI
    // follow-up when the query changes or the component unmounts.
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/foods/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        const json = await res.json();
        if (myId !== reqId.current) return;
        if (!res.ok) {
          setError(json.error ?? "Search failed");
          setResults([]);
          return;
        }
        let foods: SearchFood[] = json.foods ?? [];
        if (excludeRecipeId != null) {
          foods = foods.filter((f) => f.recipeId !== excludeRecipeId);
        }
        setResults(foods);

        if (foods.length > 0) return;

        // Empty — fire the AI fallback.
        setAiLoading(true);
        const aiMy = ++aiReqId.current;
        try {
          const aiRes = await fetch(
            `/api/foods/search/ai?q=${encodeURIComponent(q)}`,
            { signal: controller.signal }
          );
          const aiJson = await aiRes.json();
          if (aiMy !== aiReqId.current) return;
          setAiResult(aiRes.ok ? aiJson.food ?? null : null);
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return;
          if (aiMy === aiReqId.current) setAiResult(null);
        } finally {
          if (aiMy === aiReqId.current) setAiLoading(false);
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        if (myId !== reqId.current) return;
        setError("Couldn't reach the server");
        setResults([]);
      } finally {
        if (myId === reqId.current) setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, excludeRecipeId]);

  return { query, setQuery, results, loading, error, aiResult, aiLoading };
}
