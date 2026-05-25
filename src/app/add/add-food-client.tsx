"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";

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
import { logFood } from "./actions";

type Food = {
  fdcId: number;
  name: string;
  brand: string | null;
  dataType: string;
  per100g: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  servingSizeG: number | null;
  servingLabel: string | null;
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
          <Link
            href="/"
            aria-label="Back"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
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
            <p className="px-1 text-sm text-muted-foreground">
              No matches. Try another term.
            </p>
          )}

          {!loading && results.length > 0 && (() => {
            const whole = results.filter((f) => f.dataType !== "Branded");
            const branded = results.filter((f) => f.dataType === "Branded");
            const bothPresent = whole.length > 0 && branded.length > 0;

            return (
              <div className="space-y-6">
                {whole.length > 0 && (
                  <ResultGroup
                    label={bothPresent ? "Whole foods" : null}
                    foods={whole}
                    onSelect={setSelected}
                  />
                )}
                {branded.length > 0 && (
                  <ResultGroup
                    label={bothPresent ? "Branded" : null}
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
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums">
              {Math.round(f.per100g.kcal)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
        Search USDA's food database
      </p>
      <p className="mt-1 text-xs text-muted-foreground/70">
        Whole foods (Foundation, SR Legacy) and branded products.
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
  const [grams, setGrams] = useState<string>("100");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!food) return;
    setGrams(
      food.servingSizeG && food.servingSizeG > 0
        ? String(Math.round(food.servingSizeG))
        : "100"
    );
  }, [food]);

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
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    Serving
                  </Label>
                  {food.servingLabel && (
                    <span className="text-[10px] text-muted-foreground/70">
                      {food.servingLabel}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="grams"
                    inputMode="decimal"
                    value={grams}
                    onChange={(e) => setGrams(e.target.value)}
                    className="pr-12 text-lg"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">
                    g
                  </span>
                </div>
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
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
  if (t === "Foundation") return "Whole food";
  if (t === "SR Legacy") return "Reference";
  return t;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
