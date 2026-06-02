"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookmarkPlus,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, round1 } from "@/lib/utils";
import {
  dataTypeLabel,
  extractUnitName,
  formatGrams,
  formatQty,
  titleCase,
} from "@/lib/food-format";
import { useFoodSearch, type SearchFood } from "@/lib/use-food-search";
import { formatTimeInTz } from "@/lib/clock";
import { CustomFoodDialog } from "@/components/custom-food-dialog";
import { approveAiFood, logFood } from "./actions";

type Food = SearchFood;

type LoggedResult = Awaited<ReturnType<typeof logFood>>;

export type MealOption = {
  id: number;
  name: string | null;
  loggedAt: string; // ISO
  foodCount: number;
  kcal: number;
};

type Target =
  | { kind: "existing"; mealId: number }
  // `time` (HH:MM) pins the new meal at a scheduled time — set when the
  // target came from a default-meal placeholder.
  | { kind: "new"; name: string; time?: string };

// Map the picker's target + edited day into logFood's options shape.
function logOptions(target: Target, dayKey: string | null) {
  return target.kind === "existing"
    ? { mealId: target.mealId, dayKey }
    : { newMealName: target.name, newMealTime: target.time ?? null, dayKey };
}

export function AddFoodClient({
  meals,
  autoTargetId,
  suggestedNewMealName,
  timezone,
  dayKey = null,
  preselected = null,
  initialNewMeal = null,
}: {
  meals: MealOption[];
  autoTargetId: number | null;
  suggestedNewMealName: string;
  timezone: string;
  /** Past day being edited. `null` means today. */
  dayKey?: string | null;
  /** Food to open the portion sheet for on mount (an "Add to meal"
   *  deep-link from a recipe or custom food). */
  preselected?: Food | null;
  /** Pre-target a new meal at a scheduled time — set when arriving from a
   *  default-meal placeholder's "Add food". */
  initialNewMeal?: { name: string; time: string } | null;
}) {
  const backHref = dayKey ? `/day/${dayKey}` : "/";
  const router = useRouter();
  const {
    query,
    setQuery: updateQuery,
    results,
    loading,
    error: searchError,
    aiResult,
    aiLoading,
  } = useFoodSearch();
  const [selected, setSelected] = useState<Food | null>(null);

  // Deep-link "Add to meal" preselect. Open the portion sheet via an effect
  // (a closed→open transition) rather than initial state — a dialog mounted
  // already-open doesn't reliably appear. The ref opens it once per mount so
  // a later router.refresh() (after logging) doesn't reopen it.
  const didPreselect = useRef(false);
  useEffect(() => {
    if (preselected && !didPreselect.current) {
      didPreselect.current = true;
      setSelected(preselected);
    }
  }, [preselected]);

  const [target, setTarget] = useState<Target>(() =>
    initialNewMeal
      ? { kind: "new", name: initialNewMeal.name, time: initialNewMeal.time }
      : autoTargetId != null
        ? { kind: "existing", mealId: autoTargetId }
        : { kind: "new", name: suggestedNewMealName }
  );

  const [quickOpen, setQuickOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  // Which AI preview is mid-approval — keeps a spinner on just that row
  // while we persist it to CustomFood.
  const [approvingAiId, setApprovingAiId] = useState<number | null>(null);

  // A food was logged. Close whatever dialog was open and stay put so the user
  // can keep adding. Point the target at the meal we just wrote to — for a
  // brand-new meal that means the *next* food appends here instead of opening
  // another meal with the same name. Only refetch the server-rendered meal list
  // when a meal was actually created (the picker shows a chip per meal but no
  // per-meal totals, so appends leave it unchanged).
  function handleLogged({ mealId, createdMeal }: LoggedResult) {
    setSelected(null);
    setQuickOpen(false);
    setTarget({ kind: "existing", mealId });
    if (createdMeal) router.refresh();
  }

  async function onResultSelect(food: Food) {
    if (food.dataType !== "AI" || food.aiModel == null) {
      setSelected(food);
      return;
    }
    // Approve = persist to CustomFood (source='AI'), then drive the
    // portion dialog against the real DB row. Logging or canceling
    // afterwards is independent — the entry is saved either way.
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

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-6">
          <AppLink
            href={backHref}
            direction="back"
            aria-label="Back"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </AppLink>
          <span className="text-sm font-semibold tracking-tight">
            Add food
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <MealTargetPicker
          meals={meals}
          target={target}
          onChange={setTarget}
          suggestedNewMealName={suggestedNewMealName}
          timezone={timezone}
        />

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="Search foods (e.g. chicken breast, banana)"
            className="h-12 rounded-full border-border/60 bg-card pl-11 pr-11 text-base shadow-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => updateQuery("")}
              aria-label="Clear"
              className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-border bg-transparent px-4 text-xs font-medium text-muted-foreground transition-all hover:border-foreground/40 hover:bg-accent/40 hover:text-foreground"
          >
            <Zap className="h-3 w-3" />
            Just add calories
          </button>
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-border bg-transparent px-4 text-xs font-medium text-muted-foreground transition-all hover:border-foreground/40 hover:bg-accent/40 hover:text-foreground"
          >
            <BookmarkPlus className="h-3 w-3" />
            Save a custom food
          </button>
        </div>

        <div className="mt-6">
          {loading && <SourceLadder />}

          {!loading && searchError && (
            <p className="px-1 text-sm text-destructive">{searchError}</p>
          )}

          {!loading && !searchError && query.trim().length >= 2 && results.length === 0 && (
            <NoMatchesBlock
              query={query.trim()}
              aiLoading={aiLoading}
              aiResult={aiResult}
              approvingAiId={approvingAiId}
              onSelectAi={onResultSelect}
              onQuickAdd={() => setQuickOpen(true)}
            />
          )}

          {!loading && results.length > 0 && (() => {
            const recipes = results.filter(
              (f) => f.dataType === "Recipe" && !f.ownerName
            );
            const friendRecipes = results.filter(
              (f) => f.dataType === "Recipe" && f.ownerName
            );
            const custom = results.filter((f) => f.dataType === "Custom");
            const branded = results.filter(
              (f) => f.dataType === "Branded" || f.dataType === "OpenFoodFacts"
            );
            const whole = results.filter(
              (f) =>
                f.dataType !== "Recipe" &&
                f.dataType !== "Custom" &&
                f.dataType !== "Branded" &&
                f.dataType !== "OpenFoodFacts" &&
                f.dataType !== "AI"
            );
            const aiCommunity = results.filter((f) => f.dataType === "AI");
            // Always show group labels so the source of every hit is
            // visible — the user explicitly asked to see which DB each
            // result came from, even when only one group matched.
            const showLabels = true;

            // Reference (brand-free whole foods) leads after the user's own
            // recipes, then community, then brands, with AI-added rows last
            // — AI is the last resort even once it's been saved.
            return (
              <div className="space-y-6">
                {recipes.length > 0 && (
                  <ResultGroup
                    label={showLabels ? "My recipes" : null}
                    foods={recipes}
                    onSelect={onResultSelect}
                  />
                )}
                {friendRecipes.length > 0 && (
                  <ResultGroup
                    label={showLabels ? "Friends' recipes" : null}
                    foods={friendRecipes}
                    onSelect={onResultSelect}
                  />
                )}
                {whole.length > 0 && (
                  <ResultGroup
                    label={showLabels ? "Reference" : null}
                    foods={whole}
                    onSelect={onResultSelect}
                  />
                )}
                {custom.length > 0 && (
                  <ResultGroup
                    label={showLabels ? "Community" : null}
                    foods={custom}
                    onSelect={onResultSelect}
                  />
                )}
                {branded.length > 0 && (
                  <ResultGroup
                    label={showLabels ? "Branded" : null}
                    foods={branded}
                    onSelect={onResultSelect}
                  />
                )}
                {aiCommunity.length > 0 && (
                  <ResultGroup
                    label={showLabels ? "AI-added" : null}
                    foods={aiCommunity}
                    onSelect={onResultSelect}
                  />
                )}
              </div>
            );
          })()}

          {query.trim().length < 2 && <EmptyState />}
        </div>
      </main>

      <PortionDialog
        food={selected}
        target={target}
        dayKey={dayKey}
        onClose={() => setSelected(null)}
        onLogged={handleLogged}
        // When the sheet was opened from an "Add to meal" deep-link, the
        // page's meal picker is hidden behind it — surface one inside so the
        // user can still pick or create the destination meal.
        mealPicker={
          selected != null && selected === preselected
            ? { meals, onChange: setTarget, suggestedNewMealName, timezone }
            : null
        }
      />

      <QuickAddDialog
        open={quickOpen}
        target={target}
        dayKey={dayKey}
        onClose={() => setQuickOpen(false)}
        onLogged={handleLogged}
      />

      <CustomFoodDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        initialName={query.trim()}
      />
    </>
  );
}

function MealTargetPicker({
  meals,
  target,
  onChange,
  suggestedNewMealName,
  timezone,
}: {
  meals: MealOption[];
  target: Target;
  onChange: (t: Target) => void;
  suggestedNewMealName: string;
  timezone: string;
}) {
  const isNew = target.kind === "new";

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Adding to
        </span>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      <div className="-mx-2 flex flex-wrap gap-2 px-2">
        {meals.map((m) => {
          const active = target.kind === "existing" && target.mealId === m.id;
          const time = formatTimeInTz(m.loggedAt, timezone);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange({ kind: "existing", mealId: m.id })}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/60 bg-card text-foreground/80 hover:border-border hover:text-foreground"
              )}
            >
              <span>{m.name ?? "Meal"}</span>
              <span
                className={cn(
                  "tabular-nums",
                  active ? "text-background/70" : "text-muted-foreground"
                )}
              >
                {time}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() =>
            onChange(
              target.kind === "new"
                ? target
                : { kind: "new", name: suggestedNewMealName }
            )
          }
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
            isNew
              ? "border-foreground bg-foreground text-background"
              : "border-dashed border-border bg-transparent text-foreground/80 hover:border-foreground/40 hover:text-foreground"
          )}
        >
          <Sparkles className="h-3 w-3" />
          New meal
        </button>
      </div>

      {isNew && (
        <div className="pt-1">
          <Input
            value={target.name}
            onChange={(e) => onChange({ ...target, name: e.target.value })}
            placeholder={suggestedNewMealName}
            className="h-9 rounded-full border-border/60 bg-card text-sm"
          />
        </div>
      )}
    </section>
  );
}

function ResultGroup({
  label,
  foods,
  onSelect,
}: {
  label: string | null;
  foods: Food[];
  onSelect: (f: Food) => void;
}) {
  return (
    <section>
      {label && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground/60">
            {foods.length}
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
      )}
      <ul className="space-y-2">
        {foods.map((f) => (
          <ResultRow key={f.fdcId} food={f} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  );
}

function ResultRow({
  food: f,
  onSelect,
}: {
  food: Food;
  onSelect: (f: Food) => void;
}) {
  const isAi = f.dataType === "AI";
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(f)}
        className="group flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card p-4 text-left transition-all hover:border-border hover:shadow-sm"
      >
        <div className="min-w-0 flex-1 pr-4">
          <div className="flex items-center gap-1.5">
            {isAi && (
              <Sparkles className="h-3 w-3 shrink-0 text-foreground/60" />
            )}
            <p className="truncate text-sm font-medium">
              {f.dataType === "Recipe" ? f.name : titleCase(f.name)}
            </p>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {f.ownerName ? `${f.ownerName} · ` : f.brand ? `${f.brand} · ` : ""}
            {dataTypeLabel(f.dataType)}
            {f.createdAtIso && (f.dataType === "Custom" || f.dataType === "AI") && (
              <> · added {formatAddedAt(f.createdAtIso)}</>
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
            <Plus className="h-3.5 w-3.5" />
          </div>
        </div>
      </button>
    </li>
  );
}

function NoMatchesBlock({
  query,
  aiLoading,
  aiResult,
  approvingAiId,
  onSelectAi,
  onQuickAdd,
}: {
  query: string;
  aiLoading: boolean;
  aiResult: Food | null;
  approvingAiId: number | null;
  onSelectAi: (f: Food) => void;
  onQuickAdd: () => void;
}) {
  // Three branches: AI still working, AI returned a result, or AI gave
  // up too. The "Just log calories" escape hatch is always available
  // once we've exhausted the search options.
  return (
    <div className="space-y-3 px-1 text-sm">
      {aiLoading && (
        // Combined "not in DB → trying web AI" indicator. One block so
        // the user reads it as a single narrative — "not in our stuff,
        // checking the web" — rather than two separate failures.
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-foreground/30 bg-card/40 p-4">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-foreground/60" />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">
              Not in our databases — searching the web with AI…
            </p>
            <p className="text-[11px] text-muted-foreground">
              Asking Gemini to estimate nutrition for &ldquo;{query}&rdquo;
              from public sources.
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
          <AiResultRow
            food={aiResult}
            pending={approvingAiId === aiResult.fdcId}
            onSelect={onSelectAi}
          />
          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground/70">
            Generated from web search. Tap to save to the community library and
            log a portion — double-check the numbers before relying on them.
          </p>
        </div>
      )}

      {!aiLoading && !aiResult && (
        <div className="space-y-2">
          <p className="text-muted-foreground">
            Couldn&rsquo;t find &ldquo;{query}&rdquo; in our databases or via
            web search.
          </p>
          <button
            type="button"
            onClick={onQuickAdd}
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline"
          >
            <Zap className="h-3 w-3" />
            Just log the calories
          </button>
        </div>
      )}
    </div>
  );
}

function AiResultRow({
  food: f,
  pending,
  onSelect,
}: {
  food: Food;
  pending: boolean;
  onSelect: (f: Food) => void;
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

/**
 * Visible source ladder shown while the local search is in flight.
 * Surfaces the order we check: user recipes → community library → USDA
 * → Open Food Facts. The AI fallback gets its own block (NoMatchesBlock)
 * because it only runs after these four return empty, and it's the only
 * tier with non-local latency worth a distinct UX.
 */
function SourceLadder() {
  const sources = ["My recipes", "Reference", "Community", "USDA", "Open Food Facts"];
  return (
    <div className="space-y-2 px-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Searching
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <span
            key={s}
            className="inline-flex items-center rounded-full border border-border/60 bg-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-12 text-center shadow-none">
      <p className="text-sm text-muted-foreground">
        Search foods
      </p>
      <p className="mt-1 text-xs text-muted-foreground/70">
        Whole foods, South Asian dishes, USDA, Open Food Facts, and
        community-added foods.
      </p>
    </Card>
  );
}

type MealPicker = {
  meals: MealOption[];
  onChange: (t: Target) => void;
  suggestedNewMealName: string;
  timezone: string;
};

function PortionDialog({
  food,
  target,
  dayKey,
  onClose,
  onLogged,
  mealPicker,
}: {
  food: Food | null;
  target: Target;
  dayKey: string | null;
  onClose: () => void;
  onLogged: (result: LoggedResult) => void;
  mealPicker?: MealPicker | null;
}) {
  return (
    <Dialog open={!!food} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        {food && (
          <PortionForm
            key={food.fdcId}
            food={food}
            target={target}
            dayKey={dayKey}
            onLogged={onLogged}
            mealPicker={mealPicker}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PortionForm({
  food,
  target,
  dayKey,
  onLogged,
  mealPicker,
}: {
  food: Food;
  target: Target;
  dayKey: string | null;
  onLogged: (result: LoggedResult) => void;
  mealPicker?: MealPicker | null;
}) {
  const servingG =
    food.servingSizeG && food.servingSizeG > 0 ? food.servingSizeG : null;
  const unitLabel = food.servingLabel ? extractUnitName(food.servingLabel) : null;

  // Canonical state is grams. `qtyStr` is a display-only string that the user
  // can type into; we mirror it back to grams on change. We keep both as
  // separate strings so partial inputs like "1." don't get clobbered.
  const [grams, setGrams] = useState<string>(() =>
    servingG ? formatGrams(servingG) : "100"
  );
  const [qtyStr, setQtyStr] = useState<string>(() => (servingG ? "1" : ""));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onGramsChange(s: string) {
    setGrams(s);
    if (!servingG) return;
    const n = parseFloat(s);
    if (Number.isFinite(n) && n >= 0) {
      setQtyStr(formatQty(n / servingG));
    } else {
      setQtyStr("");
    }
  }

  function onQtyChange(s: string) {
    setQtyStr(s);
    if (!servingG) return;
    const n = parseFloat(s);
    if (Number.isFinite(n) && n >= 0) {
      setGrams(formatGrams(n * servingG));
    }
  }

  const g = parseFloat(grams);
  const valid = Number.isFinite(g) && g > 0 && g < 5000;
  const factor = valid ? g / 100 : 0;
  const computed = {
    kcal: food.per100g.kcal * factor,
    proteinG: food.per100g.proteinG * factor,
    carbsG: food.per100g.carbsG * factor,
    fatG: food.per100g.fatG * factor,
  };

  function onLog() {
    if (!valid) return;
    const isRecipe = food.dataType === "Recipe";
    setError(null);
    startTransition(async () => {
      try {
        const result = await logFood(
          {
            // Recipes use a synthetic display-only fdcId; the real link
            // back is the separate recipeId field.
            fdcId: isRecipe ? null : food.fdcId,
            recipeId: isRecipe ? food.recipeId ?? null : null,
            // Preserve the user's recipe name verbatim — titleCase mangles
            // brand-y or stylized capitalization the user typed in.
            name: isRecipe ? food.name : titleCase(food.name),
            brand: food.brand,
            grams: round1(g),
            kcal: round1(computed.kcal),
            proteinG: round1(computed.proteinG),
            carbsG: round1(computed.carbsG),
            fatG: round1(computed.fatG),
          },
          logOptions(target, dayKey)
        );
        onLogged(result);
      } catch (err) {
        // A failed log means the food didn't save; show it so the user doesn't
        // retry blindly and pile up empty meals.
        console.error(err);
        setError("Couldn't log that food. Please try again.");
      }
    });
  }

  return (
    <>
      <DialogTitle className="pr-6 text-base font-semibold leading-tight">
        {food.dataType === "Recipe" ? food.name : titleCase(food.name)}
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
        {mealPicker && (
          <MealTargetPicker
            meals={mealPicker.meals}
            target={target}
            onChange={mealPicker.onChange}
            suggestedNewMealName={mealPicker.suggestedNewMealName}
            timezone={mealPicker.timezone}
          />
        )}

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label
              htmlFor="grams"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Serving
            </Label>
            {servingG && unitLabel && (
              <span className="text-[10px] text-muted-foreground/70">
                1 {unitLabel} = {formatGrams(servingG)}g
              </span>
            )}
          </div>
          {servingG && unitLabel ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Input
                  id="qty"
                  inputMode="decimal"
                  value={qtyStr}
                  onChange={(e) => onQtyChange(e.target.value)}
                  className="pr-16 text-lg"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                  {unitLabel}
                </span>
              </div>
              <div className="relative">
                <Input
                  id="grams"
                  inputMode="decimal"
                  value={grams}
                  onChange={(e) => onGramsChange(e.target.value)}
                  className="pr-8 text-lg"
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">
                  g
                </span>
              </div>
            </div>
          ) : (
            <div className="relative">
              <Input
                id="grams"
                inputMode="decimal"
                value={grams}
                onChange={(e) => onGramsChange(e.target.value)}
                className="pr-12 text-lg"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">
                g
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 rounded-xl bg-muted/40 p-3">
          <Stat label="kcal" value={Math.round(computed.kcal)} emphasis />
          <Stat label="P" value={round1(computed.proteinG)} unit="g" />
          <Stat label="C" value={round1(computed.carbsG)} unit="g" />
          <Stat label="F" value={round1(computed.fatG)} unit="g" />
        </div>

        {error && (
          <p role="alert" className="text-center text-xs text-destructive">
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
            onClick={onLog}
            disabled={!valid || pending}
            className="flex-1 rounded-full"
          >
            {pending ? "Logging…" : "Log food"}
          </Button>
        </div>
      </div>
    </>
  );
}

function QuickAddDialog({
  open,
  target,
  dayKey,
  onClose,
  onLogged,
}: {
  open: boolean;
  target: Target;
  dayKey: string | null;
  onClose: () => void;
  onLogged: (result: LoggedResult) => void;
}) {
  const [kcal, setKcal] = useState("");
  const [label, setLabel] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const k = parseFloat(kcal);
  const validKcal = Number.isFinite(k) && k > 0 && k < 10000;

  function reset() {
    setKcal("");
    setLabel("");
    setProtein("");
    setCarbs("");
    setFat("");
    setError(null);
  }

  function onOpenChange(next: boolean) {
    if (!next) {
      onClose();
      reset();
    }
  }

  function submit() {
    if (!validKcal) return;
    const trimmedLabel = label.trim();
    setError(null);
    startTransition(async () => {
      try {
        const result = await logFood(
          {
            fdcId: null,
            // Save with name = label if given, otherwise the generic
            // "Quick add" so the meal-card row reads cleanly.
            name: trimmedLabel.length > 0 ? trimmedLabel : "Quick add",
            brand: null,
            grams: 0, // sentinel: "kcal-only, no portion"
            kcal: round1(k),
            proteinG: parseMacro(protein),
            carbsG: parseMacro(carbs),
            fatG: parseMacro(fat),
          },
          logOptions(target, dayKey)
        );
        // Closing via the open prop doesn't fire onOpenChange, so clear the
        // fields here — otherwise the next "quick add" reopens pre-filled with
        // what was just logged.
        reset();
        onLogged(result);
      } catch (err) {
        // Surface a failed add so it isn't mistaken for "nothing happened."
        console.error(err);
        setError("Couldn't add that. Please try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogTitle className="text-base font-semibold">
          Quick add calories
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          For when you know roughly how many calories but not the food. Macros
          are optional.
        </DialogDescription>

        <div className="mt-4 space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="qa-kcal"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Calories
            </Label>
            <div className="relative">
              <Input
                id="qa-kcal"
                inputMode="numeric"
                autoFocus
                value={kcal}
                onChange={(e) => setKcal(e.target.value)}
                placeholder="350"
                className="pr-14 text-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && validKcal) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">
                kcal
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="qa-label"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Label
              <span className="ml-1 normal-case tracking-normal text-muted-foreground/60">
                (optional)
              </span>
            </Label>
            <Input
              id="qa-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Coffee, restaurant meal, …"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Macros
              <span className="ml-1 normal-case tracking-normal text-muted-foreground/60">
                (optional)
              </span>
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <MacroInput
                id="qa-protein"
                label="P"
                value={protein}
                onChange={setProtein}
              />
              <MacroInput
                id="qa-carbs"
                label="C"
                value={carbs}
                onChange={setCarbs}
              />
              <MacroInput
                id="qa-fat"
                label="F"
                value={fat}
                onChange={setFat}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-center text-xs text-destructive">
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
              onClick={submit}
              disabled={!validKcal || pending}
              className="flex-1 rounded-full"
            >
              {pending ? "Adding…" : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MacroInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="pl-7 pr-8 tabular-nums"
      />
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
        g
      </span>
    </div>
  );
}

// Optional macros: blank → 0, otherwise clamp/round to a sane value.
function parseMacro(s: string): number {
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return round1(Math.min(n, 1000));
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

function formatAddedAt(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

