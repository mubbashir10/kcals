"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, round1 } from "@/lib/utils";
import { computeRecipeTotals } from "@/lib/recipe-totals";
import { approveAiFood } from "@/app/add/actions";
import {
  addRecipeIngredient,
  deleteRecipe,
  removeRecipeIngredient,
  renameRecipe,
  updateRecipe,
  updateRecipeIngredientGrams,
} from "@/app/actions/recipes";

// Shape of a search result from /api/foods/search. The recipe builder
// re-uses the same endpoint as the /add page, so any food in the library
// (USDA, OFF, community Custom, AI-approved) can become an ingredient.
// AI preview rows from /api/foods/search/ai also carry aiModel/aiSources
// so the parent can approve them before opening the portion dialog.
type SearchFood = {
  fdcId: number;
  name: string;
  brand: string | null;
  dataType: string;
  per100g: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  servingSizeG: number | null;
  servingLabel: string | null;
  aiModel?: string;
  aiSources?: string[];
  aiConfidence?: "low" | "medium" | "high";
};

export type RecipeBuilderIngredient = {
  id: number;
  fdcId: number | null;
  name: string;
  brand: string | null;
  per100Kcal: number;
  per100ProteinG: number;
  per100CarbsG: number;
  per100FatG: number;
  grams: number;
};

export type RecipeBuilderData = {
  id: number;
  name: string;
  /** Null = derive from sum of ingredient grams. */
  totalWeightG: number | null;
  servings: number | null;
  ingredients: RecipeBuilderIngredient[];
};

export function RecipeBuilder({ recipe }: { recipe: RecipeBuilderData }) {
  const router = useRouter();
  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<SearchFood | null>(null);
  // Which AI preview row is currently being approved — used to show a
  // spinner on just that row while we persist it to CustomFood.
  const [approvingAiId, setApprovingAiId] = useState<number | null>(null);
  const [editingIng, setEditingIng] = useState<RecipeBuilderIngredient | null>(
    null
  );
  const [, startTransition] = useTransition();

  const totals = computeRecipeTotals(recipe);

  // Search-result tap → portion dialog. AI previews are approved first
  // (persisted as a CustomFood with source='AI'), so the ingredient gets
  // a stable fdcId pointer (-customFoodId) instead of the transient
  // preview id. Mirrors /add's onResultSelect.
  async function onSearchSelect(food: SearchFood) {
    if (food.dataType !== "AI" || food.aiModel == null) {
      setSelected(food);
      return;
    }
    setApprovingAiId(food.fdcId);
    try {
      const newId = await approveAiFood({
        name: food.name,
        kcal: food.per100g.kcal,
        proteinG: food.per100g.proteinG,
        carbsG: food.per100g.carbsG,
        fatG: food.per100g.fatG,
        servingSizeG: food.servingSizeG,
        servingLabel: food.servingLabel,
        aiModel: food.aiModel,
        aiSources: food.aiSources ?? [],
      });
      setSelected({
        ...food,
        fdcId: -newId,
        // Keep the AI badge in the portion dialog so the user is still
        // reminded these are estimates as they pick a serving.
        dataType: "AI",
      });
    } catch (err) {
      console.error("AI approval failed", err);
    } finally {
      setApprovingAiId(null);
    }
  }

  async function onAddIngredient(food: SearchFood, grams: number) {
    startTransition(async () => {
      try {
        await addRecipeIngredient(recipe.id, {
          fdcId: food.fdcId,
          name: titleCase(food.name),
          brand: food.brand,
          per100Kcal: food.per100g.kcal,
          per100ProteinG: food.per100g.proteinG,
          per100CarbsG: food.per100g.carbsG,
          per100FatG: food.per100g.fatG,
          grams,
        });
        setSelected(null);
        router.refresh();
      } catch (err) {
        console.error("Failed to add ingredient", err);
      }
    });
  }

  return (
    <>
      {/* Recipe header — inline-editable name, secondary weight/servings
          button that opens the details dialog, and the menu. */}
      <section className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <InlineRecipeName recipeId={recipe.id} initialName={recipe.name} />
          <button
            type="button"
            onClick={() => setEditMetaOpen(true)}
            className="mt-1 inline-flex items-center gap-1 rounded text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {totals.effectiveTotalWeightG > 0 ? (
              <>
                {Math.round(totals.effectiveTotalWeightG)}g
                {totals.weightIsDerived ? " (from ingredients)" : " total"}
              </>
            ) : (
              <>Set weight</>
            )}
            {recipe.servings != null && (
              <> · {formatServings(recipe.servings)}</>
            )}
            {totals.servingG != null && (
              <> ({Math.round(totals.servingG)}g each)</>
            )}
          </button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Recipe options"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-expanded:bg-muted"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl p-1.5">
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="cursor-pointer rounded-lg text-sm"
                // setTimeout 0 defers the dialog open until after Base UI
                // finishes closing the menu + restoring focus, or the
                // dialog mount loses the race and never appears.
                onClick={() => setTimeout(() => setEditMetaOpen(true), 0)}
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit details
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer rounded-lg text-sm"
                onClick={() => setTimeout(() => setDeleteOpen(true), 0)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete recipe
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </section>

      {/* Derived totals — what your composition currently yields. */}
      <section className="mt-6 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Per 100g
          </span>
          {totals.perServingKcal != null && (
            <span className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground/80 tabular-nums">
                {Math.round(totals.perServingKcal)}
              </span>{" "}
              kcal / serving
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Stat label="kcal" value={Math.round(totals.per100Kcal)} emphasis />
          <Stat label="P" value={round1(totals.per100ProteinG)} unit="g" />
          <Stat label="C" value={round1(totals.per100CarbsG)} unit="g" />
          <Stat label="F" value={round1(totals.per100FatG)} unit="g" />
        </div>
      </section>

      {/* Ingredients list. */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Ingredients
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground/60">
            {recipe.ingredients.length}
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        {recipe.ingredients.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-10 text-center shadow-none">
            <p className="text-sm text-muted-foreground">No ingredients yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Search for a food below to add one.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {recipe.ingredients.map((i) => {
              const kcal = i.per100Kcal * (i.grams / 100);
              return (
                <li
                  key={i.id}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4"
                >
                  <button
                    type="button"
                    onClick={() => setEditingIng(i)}
                    className="min-w-0 flex-1 pr-4 text-left"
                  >
                    <p className="truncate text-sm font-medium">{i.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {i.brand ? `${i.brand} · ` : ""}
                      {Math.round(i.grams)}g · {Math.round(kcal)} kcal
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label="Remove ingredient"
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await removeRecipeIngredient(i.id);
                          router.refresh();
                        } catch (err) {
                          console.error(err);
                        }
                      });
                    }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Search — same data as /add, but tap appends as ingredient. */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Add ingredient
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <IngredientSearch
          onSelect={onSearchSelect}
          approvingAiId={approvingAiId}
        />
      </section>

      {/* Dialogs */}
      <IngredientPortionDialog
        food={selected}
        onClose={() => setSelected(null)}
        onAdd={onAddIngredient}
      />
      <EditIngredientDialog
        ingredient={editingIng}
        onClose={() => setEditingIng(null)}
        onSaved={() => router.refresh()}
      />
      <EditRecipeMetaDialog
        open={editMetaOpen}
        recipe={recipe}
        onClose={() => setEditMetaOpen(false)}
      />
      <DeleteRecipeDialog
        open={deleteOpen}
        recipeId={recipe.id}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

/**
 * Inline-editable recipe name. Saves on blur (or Enter) when changed.
 * When the value still equals the draft placeholder, we auto-select the
 * text on mount so the user can immediately type over it.
 */
function InlineRecipeName({
  recipeId,
  initialName,
}: {
  recipeId: number;
  initialName: string;
}) {
  const [value, setValue] = useState(initialName);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Track the last persisted value so blur with no change skips the round-trip.
  const lastSaved = useRef(initialName);

  useEffect(() => {
    // Auto-focus & select for fresh drafts so typing over works
    // immediately. The literal matches the placeholder name used by
    // createBlankRecipe.
    if (initialName === "Untitled recipe" && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [initialName]);

  function commit() {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      // Empty name is invalid — snap back to the last saved value.
      setValue(lastSaved.current);
      return;
    }
    if (trimmed === lastSaved.current) return;
    lastSaved.current = trimmed;
    startTransition(async () => {
      try {
        await renameRecipe(recipeId, trimmed);
        router.refresh();
      } catch (err) {
        console.error("Rename failed", err);
      }
    });
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      aria-label="Recipe name"
      placeholder="Recipe name"
      className={cn(
        "w-full truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 -ml-1",
        "text-2xl font-semibold tracking-tight outline-none",
        "transition-colors hover:border-border/60 focus:border-border focus:bg-card"
      )}
    />
  );
}

function IngredientSearch({
  onSelect,
  approvingAiId,
}: {
  onSelect: (food: SearchFood) => void;
  approvingAiId: number | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Second-stage AI search — fired only when the conventional search
  // returns empty, so most queries don't pay the AI latency.
  const [aiResult, setAiResult] = useState<SearchFood | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const reqId = useRef(0);
  const aiReqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);

      setError(null);

      setLoading(false);
      setAiResult(null);
      setAiLoading(false);
      return;
    }

    setLoading(true);

    setError(null);
    // Reset AI state when the query changes so stale results don't stick.
    setAiResult(null);
    setAiLoading(false);
    const myId = ++reqId.current;
    // AbortController cancels both the debounced fetch and the AI
    // follow-up when the query changes or the component unmounts — so
    // we don't pile up in-flight requests while the user is still
    // typing (especially relevant for the slow AI route).
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
        // Filter out Recipe rows — nesting a recipe inside another recipe
        // makes totals fragile (a snapshot of a snapshot) and the UX is
        // muddled. AI rows are kept; their nutrition is persisted as a
        // CustomFood on approval so it stays stable for the recipe.
        const foods: SearchFood[] = (json.foods ?? []).filter(
          (f: SearchFood) => f.dataType !== "Recipe"
        );
        setResults(foods);

        // Conventional sources covered it — skip the AI call.
        if (foods.length > 0) return;

        // Empty — fire the AI fallback and show a distinct indicator
        // while it runs. Same flow as /add.
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
        // Aborts are expected when the user keeps typing — silently ignore.
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
  }, [query]);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods to add"
          className="h-11 rounded-full border-border/60 bg-card pl-11 pr-11 text-sm shadow-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear"
            className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="mt-4">
        {loading && (
          // Source ladder for the ingredient search. Same idea as /add,
          // minus "My recipes" — Recipe rows are filtered out below so a
          // recipe can't be an ingredient of another recipe.
          <div className="space-y-2 px-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["Community", "USDA", "Open Food Facts"].map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center rounded-full border border-border/60 bg-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {!loading && error && (
          <p className="px-1 text-sm text-destructive">{error}</p>
        )}

        {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
          <div className="space-y-3 px-1 text-sm">
            {aiLoading && (
              // Combined "not in DB → trying web AI" indicator. One block
              // so the user reads it as a single narrative — "not in our
              // stuff, checking the web" — instead of two separate misses.
              <div className="flex items-start gap-3 rounded-2xl border border-dashed border-foreground/30 bg-card/40 p-4">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-foreground/60" />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">
                    Not in our databases — searching the web with AI…
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Asking Gemini to estimate nutrition for &ldquo;
                    {query.trim()}&rdquo; from public sources.
                  </p>
                </div>
              </div>
            )}

            {!aiLoading && aiResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Sparkles className="h-3 w-3 text-foreground/60" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    AI estimate
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
                <AiIngredientRow
                  food={aiResult}
                  pending={approvingAiId === aiResult.fdcId}
                  onSelect={onSelect}
                />
                <p className="px-1 text-[11px] leading-relaxed text-muted-foreground/70">
                  Generated from web search. Tap to save to the community
                  library and add as an ingredient — double-check the numbers
                  before relying on them.
                </p>
              </div>
            )}

            {!aiLoading && !aiResult && (
              <p className="text-muted-foreground">
                Couldn&rsquo;t find &ldquo;{query.trim()}&rdquo; in our
                databases or via web search.
              </p>
            )}
          </div>
        )}

        {!loading && results.length > 0 && (
          <ul className="space-y-2">
            {results.map((f) => (
              <li key={f.fdcId}>
                <button
                  type="button"
                  onClick={() => onSelect(f)}
                  className="group flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card p-3.5 text-left transition-all hover:border-border hover:shadow-sm"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="truncate text-sm font-medium">
                      {titleCase(f.name)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {f.brand ? `${f.brand} · ` : ""}
                      {dataTypeLabel(f.dataType)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {Math.round(f.per100g.kcal)}
                      </div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        kcal/100g
                      </div>
                    </div>
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-muted transition-colors group-hover:bg-foreground group-hover:text-background">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AiIngredientRow({
  food: f,
  pending,
  onSelect,
}: {
  food: SearchFood;
  pending: boolean;
  onSelect: (f: SearchFood) => void;
}) {
  const confidence = f.aiConfidence;
  return (
    <button
      type="button"
      onClick={() => onSelect(f)}
      disabled={pending}
      className="group flex w-full items-center justify-between rounded-2xl border border-dashed border-foreground/30 bg-card p-4 text-left transition-all hover:border-foreground/60 hover:shadow-sm disabled:cursor-wait disabled:opacity-70"
    >
      <div className="min-w-0 flex-1 pr-4">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 shrink-0 text-foreground/60" />
          <p className="truncate text-sm font-medium">{titleCase(f.name)}</p>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          AI estimate
          {confidence && confidence !== "high" && (
            <> · {confidence} confidence</>
          )}
          {f.aiSources && f.aiSources.length > 0 && (
            <> · {f.aiSources.length} source{f.aiSources.length === 1 ? "" : "s"}</>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums">
            {Math.round(f.per100g.kcal)}
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            kcal/100g
          </div>
        </div>
        <div className="grid h-7 w-7 place-items-center rounded-full bg-muted transition-colors group-hover:bg-foreground group-hover:text-background">
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </div>
      </div>
    </button>
  );
}

function IngredientPortionDialog({
  food,
  onClose,
  onAdd,
}: {
  food: SearchFood | null;
  onClose: () => void;
  onAdd: (food: SearchFood, grams: number) => void;
}) {
  const [grams, setGrams] = useState<string>("100");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!food) return;
    const initial =
      food.servingSizeG && food.servingSizeG > 0 ? food.servingSizeG : 100;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrams(String(Math.round(initial)));
     
    setPending(false);
  }, [food]);

  const g = parseFloat(grams);
  const valid = Number.isFinite(g) && g > 0 && g < 50000;
  const factor = valid ? g / 100 : 0;
  const preview = food
    ? {
        kcal: food.per100g.kcal * factor,
        proteinG: food.per100g.proteinG * factor,
        carbsG: food.per100g.carbsG * factor,
        fatG: food.per100g.fatG * factor,
      }
    : null;

  return (
    <Dialog open={!!food} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        {food && (
          <>
            <DialogTitle className="pr-6 text-base font-semibold leading-tight">
              {titleCase(food.name)}
            </DialogTitle>
            {food.dataType === "AI" ? (
              <DialogDescription className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                AI estimate — verify before relying on it
              </DialogDescription>
            ) : (
              food.brand && (
                <DialogDescription className="text-xs text-muted-foreground">
                  {food.brand}
                </DialogDescription>
              )
            )}

            <div className="mt-4 space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="ing-grams"
                  className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Amount in recipe
                </Label>
                <div className="relative">
                  <Input
                    id="ing-grams"
                    inputMode="decimal"
                    autoFocus
                    value={grams}
                    onChange={(e) => setGrams(e.target.value)}
                    className="pr-8 text-lg"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">
                    g
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 rounded-xl bg-muted/40 p-3">
                <Stat
                  label="kcal"
                  value={preview ? Math.round(preview.kcal) : 0}
                  emphasis
                />
                <Stat
                  label="P"
                  value={preview ? round1(preview.proteinG) : 0}
                  unit="g"
                />
                <Stat
                  label="C"
                  value={preview ? round1(preview.carbsG) : 0}
                  unit="g"
                />
                <Stat
                  label="F"
                  value={preview ? round1(preview.fatG) : 0}
                  unit="g"
                />
              </div>

              <div className="flex gap-2">
                <DialogClose
                  render={
                    <Button variant="ghost" className="flex-1 rounded-full" />
                  }
                >
                  Cancel
                </DialogClose>
                <Button
                  onClick={() => {
                    if (!valid) return;
                    setPending(true);
                    onAdd(food, g);
                  }}
                  disabled={!valid || pending}
                  className="flex-1 rounded-full"
                >
                  {pending ? "Adding…" : "Add to recipe"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditIngredientDialog({
  ingredient,
  onClose,
  onSaved,
}: {
  ingredient: RecipeBuilderIngredient | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [grams, setGrams] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ingredient) setGrams(String(Math.round(ingredient.grams)));
  }, [ingredient]);

  const g = parseFloat(grams);
  const valid = Number.isFinite(g) && g > 0 && g < 50000;

  function onSave() {
    if (!ingredient || !valid) return;
    startTransition(async () => {
      try {
        await updateRecipeIngredientGrams(ingredient.id, g);
        onSaved();
        onClose();
      } catch (err) {
        console.error(err);
      }
    });
  }

  return (
    <Dialog open={!!ingredient} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        {ingredient && (
          <>
            <DialogTitle className="text-base font-semibold leading-tight">
              {ingredient.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update how much of this went into the recipe.
            </DialogDescription>

            <div className="mt-4 space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="edit-ing-grams"
                  className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Amount
                </Label>
                <div className="relative">
                  <Input
                    id="edit-ing-grams"
                    inputMode="decimal"
                    autoFocus
                    value={grams}
                    onChange={(e) => setGrams(e.target.value)}
                    className="pr-8 text-lg"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">
                    g
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <DialogClose
                  render={
                    <Button variant="ghost" className="flex-1 rounded-full" />
                  }
                >
                  Cancel
                </DialogClose>
                <Button
                  onClick={onSave}
                  disabled={!valid || pending}
                  className="flex-1 rounded-full"
                >
                  {pending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditRecipeMetaDialog({
  open,
  recipe,
  onClose,
}: {
  open: boolean;
  recipe: RecipeBuilderData;
  onClose: () => void;
}) {
  const [name, setName] = useState(recipe.name);
  const [weight, setWeight] = useState(
    recipe.totalWeightG != null ? String(Math.round(recipe.totalWeightG)) : ""
  );
  const [servings, setServings] = useState(
    recipe.servings != null ? String(recipe.servings) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(recipe.name);

      setWeight(
        recipe.totalWeightG != null ? String(Math.round(recipe.totalWeightG)) : ""
      );

      setServings(recipe.servings != null ? String(recipe.servings) : "");

      setError(null);
    }
  }, [open, recipe]);

  function onSave() {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    // Blank weight means "derive from ingredient sum".
    let w: number | null = null;
    if (weight.trim() !== "") {
      const parsed = parseFloat(weight);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError("Total weight must be a positive number.");
        return;
      }
      w = parsed;
    }
    const s = servings.trim() === "" ? null : parseFloat(servings);
    if (s != null && (!Number.isFinite(s) || s <= 0)) {
      setError("Servings must be a positive number.");
      return;
    }

    startTransition(async () => {
      try {
        await updateRecipe(recipe.id, {
          name: trimmedName,
          totalWeightG: w,
          servings: s,
        });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogTitle className="text-base font-semibold">
          Edit recipe
        </DialogTitle>

        <div className="mt-4 space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="r-edit-name"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Name
            </Label>
            <Input
              id="r-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label
                htmlFor="r-edit-weight"
                className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                Total weight
              </Label>
              <div className="relative">
                <Input
                  id="r-edit-weight"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="auto"
                  className="pr-8"
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-muted-foreground">
                  g
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="r-edit-servings"
                className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                Servings
              </Label>
              <Input
                id="r-edit-servings"
                inputMode="decimal"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <DialogClose
              render={
                <Button variant="ghost" className="flex-1 rounded-full" />
              }
            >
              Cancel
            </DialogClose>
            <Button
              onClick={onSave}
              disabled={pending}
              className="flex-1 rounded-full"
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRecipeDialog({
  open,
  recipeId,
  onClose,
}: {
  open: boolean;
  recipeId: number;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onConfirm() {
    startTransition(async () => {
      try {
        await deleteRecipe(recipeId);
        router.replace("/recipes");
      } catch (err) {
        console.error(err);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogTitle className="text-base font-semibold">
          Delete recipe?
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Old diary rows logged from this recipe stay put — only the recipe
          itself is removed.
        </DialogDescription>
        <div className="mt-4 flex gap-2">
          <DialogClose
            render={
              <Button variant="ghost" className="flex-1 rounded-full" />
            }
          >
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
            className="flex-1 rounded-full"
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  unit,
  emphasis,
}: {
  label: string;
  value: number;
  unit?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={cn(
          "tabular-nums tracking-tight",
          emphasis ? "text-xl font-semibold" : "text-base font-medium"
        )}
      >
        {value}
        {unit && (
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function formatServings(n: number): string {
  const rounded = round1(n);
  if (rounded === 1) return "1 serving";
  return `${rounded} servings`;
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function dataTypeLabel(t: string) {
  if (t === "Branded") return "Branded";
  if (t === "OpenFoodFacts") return "Branded";
  if (t === "Foundation") return "Whole food";
  if (t === "SR Legacy") return "Reference";
  if (t === "Custom") return "Community";
  return t;
}

