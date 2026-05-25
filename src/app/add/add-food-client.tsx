"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { cn } from "@/lib/utils";
import { formatTimeInTz } from "@/lib/clock";
import { CustomFoodDialog } from "@/components/custom-food-dialog";
import { logFood } from "./actions";

type Food = {
  fdcId: number;
  name: string;
  brand: string | null;
  dataType: string;
  per100g: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  servingSizeG: number | null;
  servingLabel: string | null;
  /** Only set for community-contributed custom foods. */
  createdAtIso?: string;
};

export type MealOption = {
  id: number;
  name: string | null;
  loggedAt: string; // ISO
  foodCount: number;
  kcal: number;
};

type Target =
  | { kind: "existing"; mealId: number }
  | { kind: "new"; name: string };

export function AddFoodClient({
  meals,
  autoTargetId,
  suggestedNewMealName,
  timezone,
}: {
  meals: MealOption[];
  autoTargetId: number | null;
  suggestedNewMealName: string;
  timezone: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Food | null>(null);

  const [target, setTarget] = useState<Target>(() =>
    autoTargetId != null
      ? { kind: "existing", mealId: autoTargetId }
      : { kind: "new", name: suggestedNewMealName }
  );

  const [quickOpen, setQuickOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setSearchError(null);
      return;
    }

    setLoading(true);
    setSearchError(null);

    const myId = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/foods/search?q=${encodeURIComponent(q)}`
        );
        const json = await res.json();
        if (myId !== reqId.current) return;
        if (!res.ok) {
          setSearchError(json.error ?? "Search failed");
          setResults([]);
        } else {
          setResults(json.foods ?? []);
        }
      } catch {
        if (myId !== reqId.current) return;
        setSearchError("Couldn't reach the server");
        setResults([]);
      } finally {
        if (myId === reqId.current) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [query]);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-6">
          <AppLink
            href="/"
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods (e.g. chicken breast, banana)"
            className="h-12 rounded-full border-border/60 bg-card pl-11 pr-11 text-base shadow-sm"
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
          {loading && (
            <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching…
            </div>
          )}

          {!loading && searchError && (
            <p className="px-1 text-sm text-destructive">{searchError}</p>
          )}

          {!loading && !searchError && query.trim().length >= 2 && results.length === 0 && (
            <div className="px-1 text-sm">
              <p className="text-muted-foreground">No matches for “{query.trim()}”.</p>
              <button
                type="button"
                onClick={() => setQuickOpen(true)}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline"
              >
                <Zap className="h-3 w-3" />
                Just log the calories
              </button>
            </div>
          )}

          {!loading && results.length > 0 && (() => {
            const custom = results.filter((f) => f.dataType === "Custom");
            const branded = results.filter(
              (f) => f.dataType === "Branded" || f.dataType === "OpenFoodFacts"
            );
            const whole = results.filter(
              (f) =>
                f.dataType !== "Custom" &&
                f.dataType !== "Branded" &&
                f.dataType !== "OpenFoodFacts"
            );
            // Show group labels whenever more than one group has results.
            const groupCount =
              (custom.length > 0 ? 1 : 0) +
              (whole.length > 0 ? 1 : 0) +
              (branded.length > 0 ? 1 : 0);
            const showLabels = groupCount > 1;

            return (
              <div className="space-y-6">
                {custom.length > 0 && (
                  <ResultGroup
                    label={showLabels ? "Community" : null}
                    foods={custom}
                    onSelect={setSelected}
                  />
                )}
                {whole.length > 0 && (
                  <ResultGroup
                    label={showLabels ? "Whole foods" : null}
                    foods={whole}
                    onSelect={setSelected}
                  />
                )}
                {branded.length > 0 && (
                  <ResultGroup
                    label={showLabels ? "Branded" : null}
                    foods={branded}
                    onSelect={setSelected}
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
        onClose={() => setSelected(null)}
      />

      <QuickAddDialog
        open={quickOpen}
        target={target}
        onClose={() => setQuickOpen(false)}
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
            onChange({
              kind: "new",
              name: target.kind === "new" ? target.name : suggestedNewMealName,
            })
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
            onChange={(e) => onChange({ kind: "new", name: e.target.value })}
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
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(f)}
        className="group flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card p-4 text-left transition-all hover:border-border hover:shadow-sm"
      >
        <div className="min-w-0 flex-1 pr-4">
          <p className="truncate text-sm font-medium">{titleCase(f.name)}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {f.brand ? `${f.brand} · ` : ""}
            {dataTypeLabel(f.dataType)}
            {f.createdAtIso && f.dataType === "Custom" && (
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

function EmptyState() {
  return (
    <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-12 text-center shadow-none">
      <p className="text-sm text-muted-foreground">
        Search foods
      </p>
      <p className="mt-1 text-xs text-muted-foreground/70">
        USDA, Open Food Facts, and community-added foods.
      </p>
    </Card>
  );
}

function PortionDialog({
  food,
  target,
  onClose,
}: {
  food: Food | null;
  target: Target;
  onClose: () => void;
}) {
  // Canonical state is grams. `qtyStr` is a display-only string that the user
  // can type into; we mirror it back to grams on change. We keep both as
  // separate strings so partial inputs like "1." don't get clobbered.
  const [grams, setGrams] = useState<string>("100");
  const [qtyStr, setQtyStr] = useState<string>("1");
  const [pending, startTransition] = useTransition();

  const servingG = food?.servingSizeG && food.servingSizeG > 0 ? food.servingSizeG : null;
  const unitLabel = food?.servingLabel ? extractUnitName(food.servingLabel) : null;

  useEffect(() => {
    if (!food) return;
    if (servingG) {
      setGrams(formatGrams(servingG));
      setQtyStr("1");
    } else {
      setGrams("100");
      setQtyStr("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food]);

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
  const computed = food
    ? {
        kcal: food.per100g.kcal * factor,
        proteinG: food.per100g.proteinG * factor,
        carbsG: food.per100g.carbsG * factor,
        fatG: food.per100g.fatG * factor,
      }
    : null;

  function onLog() {
    if (!food || !valid || !computed) return;
    startTransition(async () => {
      try {
        await logFood(
          {
            fdcId: food.fdcId,
            name: titleCase(food.name),
            brand: food.brand,
            grams: round1(g),
            kcal: round1(computed.kcal),
            proteinG: round1(computed.proteinG),
            carbsG: round1(computed.carbsG),
            fatG: round1(computed.fatG),
          },
          target.kind === "existing"
            ? { mealId: target.mealId }
            : { newMealName: target.name }
        );
      } catch (err) {
        if (err instanceof Error && !err.message.includes("NEXT_REDIRECT")) {
          console.error(err);
        }
      }
    });
  }

  return (
    <Dialog open={!!food} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        {food && (
          <>
            <DialogTitle className="pr-6 text-base font-semibold leading-tight">
              {titleCase(food.name)}
            </DialogTitle>
            {food.brand && (
              <DialogDescription className="text-xs text-muted-foreground">
                {food.brand}
              </DialogDescription>
            )}

            <div className="mt-4 space-y-5">
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
                <Stat
                  label="kcal"
                  value={computed ? Math.round(computed.kcal) : 0}
                  emphasis
                />
                <Stat
                  label="P"
                  value={computed ? round1(computed.proteinG) : 0}
                  unit="g"
                />
                <Stat
                  label="C"
                  value={computed ? round1(computed.carbsG) : 0}
                  unit="g"
                />
                <Stat
                  label="F"
                  value={computed ? round1(computed.fatG) : 0}
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
                  onClick={onLog}
                  disabled={!valid || pending}
                  className="flex-1 rounded-full"
                >
                  {pending ? "Logging…" : "Log food"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuickAddDialog({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: Target;
  onClose: () => void;
}) {
  const [kcal, setKcal] = useState("");
  const [label, setLabel] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [pending, startTransition] = useTransition();

  const k = parseFloat(kcal);
  const validKcal = Number.isFinite(k) && k > 0 && k < 10000;

  function reset() {
    setKcal("");
    setLabel("");
    setProtein("");
    setCarbs("");
    setFat("");
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
    startTransition(async () => {
      try {
        await logFood(
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
          target.kind === "existing"
            ? { mealId: target.mealId }
            : { newMealName: target.name }
        );
      } catch (err) {
        if (err instanceof Error && !err.message.includes("NEXT_REDIRECT")) {
          console.error(err);
        }
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

function formatAddedAt(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// "1 paratha" → "paratha"; "1 scoop (30g protein)" → "scoop";
// falls back to the raw label if nothing strippable is found.
function extractUnitName(label: string): string {
  const stripped = label
    .replace(/^\s*1\s+/, "")
    .replace(/\s*\(.+\)\s*$/, "")
    .trim();
  return stripped.length > 0 ? stripped : label;
}

function formatGrams(n: number): string {
  return String(Math.round(n));
}

// Up to 2 decimals, trailing zeros trimmed: 1.5, 0.63, 80
function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}
