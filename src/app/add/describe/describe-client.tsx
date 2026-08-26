"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { listMealsOnDay } from "@/app/actions/meals";
import { formatTimeInTz } from "@/lib/clock";
import {
  dataTypeLabel,
  displayFoodName,
  extractUnitName,
  formatGrams,
  formatQty,
} from "@/lib/food-format";
import { scaleFrom100g } from "@/lib/nutrition";
import { resolveGrams, type GramsBasis } from "@/lib/portion";
import type { SearchFood } from "@/lib/use-food-search";
import { cn, parseFiniteNumber } from "@/lib/utils";

import { logDescribedMeals } from "./actions";
import { MAX_DUMP_CHARS, type DescribedMeal } from "./types";

// Type-only: the parser's output shape. Erased at compile time, so none of
// ai-meal.ts's server-side imports reach the browser.
import type { ParsedItem, ParsedMeal } from "@/lib/ai-meal";

// A meal already on the day, or a default-meal placeholder waiting to
// become one. Derived from the server action's return type — the action
// file is "use server" and can't export the type itself.
type MealOption = Awaited<ReturnType<typeof listMealsOnDay>>[number];

type Phase = "compose" | "parsing" | "review";

type Row = {
  id: string;
  parsed: ParsedItem;
  status: "resolving" | "ready";
  /** Ladder rows the matcher chose between — offered for switching. */
  candidates: SearchFood[];
  /** AI-researched fallback, kept even when unselected so it stays one
   *  tap away. Reference-equal to `chosen` when it's the pick, which is
   *  how the commit path knows this food still needs saving. */
  aiPreview: SearchFood | null;
  chosen: SearchFood | null;
  grams: number;
  gramsBasis: GramsBasis;
  gramsDetail: string | null;
  /** Once the user types a weight, no match change may overwrite it. */
  gramsEdited: boolean;
};

type Group = {
  id: string;
  /** Name for a meal we'd create. Ignored when targeting an existing one. */
  name: string;
  timeHhmm: string | null;
  /** The MealOption key this group targets — "meal:<id>" for a meal that
   *  exists, "default:<name>" for a placeholder — or "new". Everything but
   *  a real meal is resolved by name at save time. */
  targetKey: string;
  rows: Row[];
};

// How many items resolve at once. Each one can hit USDA, Open Food Facts
// and a model call, so this is politeness to those APIs as much as pacing.
const RESOLVE_CONCURRENCY = 4;

const EXAMPLE =
  "Peanut butter 16g, Dawn multigrain bread 2 slices and a teaspoon of honey for breakfast.\nChicken biryani, about a plate, for lunch.";

function kcalOf(row: Row): number {
  if (!row.chosen) return 0;
  return scaleFrom100g(row.chosen.per100g, row.grams).kcal;
}

function groupKcal(group: Group): number {
  return group.rows.reduce((a, r) => a + kcalOf(r), 0);
}

/** The item as the user wrote it — shown while a row is still resolving,
 *  and as the subtitle of one that found nothing. */
function rawLabel(item: ParsedItem): string {
  const qty =
    item.unit === "serving"
      ? item.quantity > 1
        ? `${formatQty(item.quantity)} × `
        : ""
      : `${formatQty(item.quantity)} ${item.unit} `;
  return `${qty}${item.query}${item.brand ? ` (${item.brand})` : ""}`;
}

export function DescribeClient({
  mealOptions,
  dayKey,
  isToday,
  timezone,
  suggestedMealName,
}: {
  mealOptions: MealOption[];
  dayKey: string;
  isToday: boolean;
  timezone: string;
  suggestedMealName: string;
}) {
  const router = useRouter();
  const backHref = isToday ? "/" : `/day/${dayKey}`;

  const [phase, setPhase] = useState<Phase>("compose");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [saving, startSaving] = useTransition();

  // Bumped on every read, so results from an abandoned parse can't land in
  // a newer one's rows.
  const runId = useRef(0);

  function updateRow(groupId: string, rowId: string, patch: Partial<Row>) {
    setGroups((gs) =>
      gs.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              rows: g.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
            }
      )
    );
  }

  function updateGroup(groupId: string, patch: Partial<Group>) {
    setGroups((gs) =>
      gs.map((g) => (g.id !== groupId ? g : { ...g, ...patch }))
    );
  }

  /** Turn a parsed meal into a review group, pointing it at the meal it
   *  named: an existing card, an unfilled placeholder, or a new meal. */
  function toGroup(meal: ParsedMeal, index: number): Group {
    const named = meal.mealName?.trim().toLowerCase();
    const match = named
      ? mealOptions.find((m) => m.name?.trim().toLowerCase() === named)
      : undefined;

    return {
      id: `g${index}`,
      // A placeholder has no row yet, so it's targeted by name — filling it
      // is what turns it into a real meal, at its own scheduled time.
      name: match?.name ?? meal.mealName?.trim() ?? suggestedMealName,
      timeHhmm: match?.timeHhmm ?? meal.timeHhmm,
      targetKey: match?.key ?? "new",
      rows: meal.items.map((item, i) => ({
        id: `g${index}i${i}`,
        parsed: item,
        status: "resolving",
        candidates: [],
        aiPreview: null,
        chosen: null,
        grams: 0,
        gramsBasis: "estimated",
        gramsDetail: null,
        gramsEdited: false,
      })),
    };
  }

  async function resolveAll(initial: Group[], token: number) {
    const queue = initial.flatMap((g) =>
      g.rows.map((r) => ({ groupId: g.id, rowId: r.id, item: r.parsed }))
    );

    await Promise.all(
      Array.from({ length: RESOLVE_CONCURRENCY }, async () => {
        while (queue.length > 0) {
          const job = queue.shift()!;
          let data: {
            candidates?: SearchFood[];
            matchIndex?: number | null;
            ai?: SearchFood | null;
          } | null = null;
          try {
            const res = await fetch("/api/meals/resolve", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ item: job.item }),
            });
            if (res.ok) data = await res.json();
          } catch {
            // Leave the row unmatched — it renders as "couldn't find this"
            // and the user can drop it or pick a food themselves.
          }
          if (token !== runId.current) return;

          const candidates = data?.candidates ?? [];
          const aiPreview = data?.ai ?? null;
          const matched =
            data?.matchIndex != null ? candidates[data.matchIndex] ?? null : null;
          const chosen = matched ?? aiPreview;
          const g = resolveGrams(job.item, chosen);

          updateRow(job.groupId, job.rowId, {
            status: "ready",
            candidates,
            aiPreview,
            chosen,
            grams: g.grams,
            gramsBasis: g.basis,
            gramsDetail: g.detail,
          });
        }
      })
    );
  }

  async function onRead() {
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    const token = ++runId.current;

    setError(null);
    setPhase("parsing");
    try {
      const res = await fetch("/api/meals/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed, dayKey }),
      });
      const json = await res.json();
      if (token !== runId.current) return;
      if (!res.ok) {
        setError(json.error ?? "Couldn't read that.");
        setPhase("compose");
        return;
      }
      const parsed: ParsedMeal[] = json.meals ?? [];
      if (parsed.length === 0) {
        setError(
          "I couldn't find any food in that. Name the foods and roughly how much."
        );
        setPhase("compose");
        return;
      }
      const next = parsed.map(toGroup);
      setGroups(next);
      setPhase("review");
      void resolveAll(next, token);
    } catch {
      if (token !== runId.current) return;
      setError("Couldn't reach the server.");
      setPhase("compose");
    }
  }

  /** Swap a row's match, re-deriving the weight unless the user set it. */
  function onPickMatch(groupId: string, row: Row, food: SearchFood | null) {
    const patch: Partial<Row> = { chosen: food };
    if (!row.gramsEdited) {
      const g = resolveGrams(row.parsed, food);
      patch.grams = g.grams;
      patch.gramsBasis = g.basis;
      patch.gramsDetail = g.detail;
    }
    updateRow(groupId, row.id, patch);
  }

  function onRemoveRow(groupId: string, rowId: string) {
    setGroups((gs) =>
      gs
        .map((g) =>
          g.id !== groupId ? g : { ...g, rows: g.rows.filter((r) => r.id !== rowId) }
        )
        .filter((g) => g.rows.length > 0)
    );
  }

  function startOver() {
    runId.current += 1;
    setGroups([]);
    setError(null);
    setPhase("compose");
  }

  // Only matched rows with a weight can be logged; the rest are shown but
  // sit out. Rows still resolving hold the button until they land.
  const loggable = groups.flatMap((g) =>
    g.rows.filter((r) => r.chosen && r.grams > 0)
  );
  const stillResolving = groups.some((g) =>
    g.rows.some((r) => r.status === "resolving")
  );
  const totalKcal = groups.reduce((a, g) => a + groupKcal(g), 0);

  function onSave() {
    const payload: DescribedMeal[] = groups
      .map((g) => {
        const rows = g.rows.filter((r) => r.chosen && r.grams > 0);
        const existingId = /^meal:(\d+)$/.exec(g.targetKey)?.[1];
        return {
          // A placeholder target has no row yet, so it resolves by name at
          // save time exactly as a new meal does.
          mealId: existingId ? Number(existingId) : null,
          name: g.name,
          timeHhmm: g.timeHhmm,
          items: rows.map((r) => {
            const food = r.chosen!;
            // Reference equality: this row picked the AI estimate, which
            // has no library row behind it yet.
            const isUnsavedAi = food === r.aiPreview;
            return {
              fdcId: isUnsavedAi ? null : food.fdcId,
              recipeId: food.recipeId ?? null,
              name: food.name,
              verbatimName: food.dataType === "Recipe",
              brand: food.brand,
              grams: r.grams,
              per100g: food.per100g,
              ai: isUnsavedAi
                ? {
                    aiModel: food.aiModel ?? "unknown",
                    aiSources: food.aiSources ?? [],
                    servingSizeG: food.servingSizeG,
                    servingLabel: food.servingLabel,
                  }
                : null,
            };
          }),
        };
      })
      .filter((m) => m.items.length > 0);

    if (payload.length === 0) return;

    startSaving(async () => {
      try {
        await logDescribedMeals({ dayKey, meals: payload });
        router.push(backHref);
        router.refresh();
      } catch (err) {
        console.error("Logging described meals failed", err);
        setError("Couldn't save that. Try again.");
      }
    });
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
            Describe a meal
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8 pb-32">
        {phase !== "review" && (
          <ComposeStep
            text={text}
            onTextChange={setText}
            onRead={onRead}
            parsing={phase === "parsing"}
            error={error}
          />
        )}

        {phase === "review" && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold tracking-tight">
                  Check this over
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  Weights are estimates unless you gave one. Tap a food to
                  swap the match.
                </p>
              </div>
              <button
                type="button"
                onClick={startOver}
                className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Start over
              </button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                mealOptions={mealOptions}
                timezone={timezone}
                onChangeGroup={(patch) => updateGroup(group.id, patch)}
                onPickMatch={(row, food) => onPickMatch(group.id, row, food)}
                onEditGrams={(row, grams) =>
                  updateRow(group.id, row.id, { grams, gramsEdited: true })
                }
                onRemoveRow={(rowId) => onRemoveRow(group.id, rowId)}
              />
            ))}
          </div>
        )}
      </main>

      {phase === "review" && (
        <div className="sticky bottom-0 z-10 border-t border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-6 py-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold tabular-nums">
                {Math.round(totalKcal)} kcal
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {loggable.length} {loggable.length === 1 ? "food" : "foods"} ·{" "}
                {groups.length} {groups.length === 1 ? "meal" : "meals"}
              </div>
            </div>
            <Button
              onClick={onSave}
              disabled={saving || stillResolving || loggable.length === 0}
              className="rounded-full px-6"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Logging…
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Log it
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function ComposeStep({
  text,
  onTextChange,
  onRead,
  parsing,
  error,
}: {
  text: string;
  onTextChange: (v: string) => void;
  onRead: () => void;
  parsing: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          Tell me what you ate
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plain words. Give grams where you know them and I&apos;ll estimate
          the rest, then you check it before anything is logged.
        </p>
      </div>

      <textarea
        autoFocus
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        onKeyDown={(e) => {
          // ⌘/Ctrl+Enter submits; plain Enter is a newline, because a dump
          // is naturally multi-line.
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onRead();
          }
        }}
        rows={6}
        maxLength={MAX_DUMP_CHARS}
        placeholder={EXAMPLE}
        disabled={parsing}
        className="w-full resize-none rounded-2xl border border-border/60 bg-card p-4 text-base leading-relaxed shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 md:text-sm"
      />

      {error && <p className="px-1 text-sm text-destructive">{error}</p>}

      <Button
        onClick={onRead}
        disabled={parsing || text.trim().length < 3}
        className="w-full rounded-full"
        size="lg"
      >
        {parsing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading what you ate…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Read it
          </>
        )}
      </Button>

      <p className="px-1 text-center text-[11px] text-muted-foreground">
        Each food is matched against your own log first, then your saved
        foods and recipes, then the food databases.
      </p>
    </div>
  );
}

function GroupCard({
  group,
  mealOptions,
  timezone,
  onChangeGroup,
  onPickMatch,
  onEditGrams,
  onRemoveRow,
}: {
  group: Group;
  mealOptions: MealOption[];
  timezone: string;
  onChangeGroup: (patch: Partial<Group>) => void;
  onPickMatch: (row: Row, food: SearchFood | null) => void;
  onEditGrams: (row: Row, grams: number) => void;
  onRemoveRow: (rowId: string) => void;
}) {
  const [editingTarget, setEditingTarget] = useState(false);
  // A placeholder target is still a meal we have to create, so only a
  // target with a real row counts as "adds to".
  const target = mealOptions.find((m) => m.key === group.targetKey);
  const existing = target?.id != null ? target : null;

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 p-0 shadow-none">
      <header className="border-b border-border/60 bg-muted/20 px-5 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="truncate text-sm font-semibold tracking-tight">
            {existing ? existing.name ?? "Meal" : group.name || "New meal"}
          </h2>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {Math.round(groupKcal(group))} kcal
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <p className="min-w-0 truncate text-[11px] text-muted-foreground">
            {existing
              ? `Adds to your ${existing.name ?? "meal"} at ${formatTimeInTz(
                  existing.loggedAt,
                  timezone
                )}`
              : `Creates ${group.name || "a meal"}${
                  group.timeHhmm ? ` at ${group.timeHhmm}` : ""
                }`}
          </p>
          <button
            type="button"
            onClick={() => setEditingTarget((v) => !v)}
            className="shrink-0 text-[11px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {editingTarget ? "Done" : "Change"}
          </button>
        </div>

        {editingTarget && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {mealOptions.map((m) => {
                const active = group.targetKey === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() =>
                      onChangeGroup({
                        targetKey: m.key,
                        // A placeholder has no row yet: it's created by
                        // name at its scheduled time when food lands in it.
                        ...(m.id == null
                          ? { name: m.name ?? group.name, timeHhmm: m.timeHhmm }
                          : {}),
                      })
                    }
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : m.id == null
                          ? "border-dashed border-border bg-transparent text-foreground/80 hover:border-foreground/40"
                          : "border-border/60 bg-card text-foreground/80 hover:border-border"
                    )}
                  >
                    <span>{m.name ?? "Meal"}</span>
                    <span
                      className={cn(
                        "tabular-nums",
                        active ? "text-background/70" : "text-muted-foreground"
                      )}
                    >
                      {formatTimeInTz(m.loggedAt, timezone)}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => onChangeGroup({ targetKey: "new" })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  group.targetKey === "new"
                    ? "border-foreground bg-foreground text-background"
                    : "border-dashed border-border bg-transparent text-foreground/80 hover:border-foreground/40"
                )}
              >
                <Sparkles className="h-3 w-3" />
                New meal
              </button>
            </div>

            {!existing && (
              <Input
                value={group.name}
                onChange={(e) =>
                  // Renaming a placeholder target means it is no longer that
                  // placeholder — the name is what links the two.
                  onChangeGroup({ name: e.target.value, targetKey: "new" })
                }
                placeholder="Meal name"
                className="h-9 rounded-full border-border/60 bg-card text-sm"
              />
            )}
          </div>
        )}
      </header>

      <ul className="divide-y divide-border/60">
        {group.rows.map((row) => (
          <ItemRow
            key={row.id}
            row={row}
            onPickMatch={(food) => onPickMatch(row, food)}
            onEditGrams={(grams) => onEditGrams(row, grams)}
            onRemove={() => onRemoveRow(row.id)}
          />
        ))}
      </ul>
    </Card>
  );
}

function ItemRow({
  row,
  onPickMatch,
  onEditGrams,
  onRemove,
}: {
  row: Row;
  onPickMatch: (food: SearchFood | null) => void;
  onEditGrams: (grams: number) => void;
  onRemove: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [gramsText, setGramsText] = useState(() => String(row.grams));

  if (row.status === "resolving") {
    return (
      <li className="flex items-center gap-3 px-5 py-4">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        <span className="truncate text-sm text-muted-foreground">
          {rawLabel(row.parsed)}
        </span>
      </li>
    );
  }

  const food = row.chosen;
  // The resolver owns the weight until the user takes it over.
  const shown = row.gramsEdited ? gramsText : String(row.grams);

  return (
    <li className="flex items-center gap-2 px-5 py-3">
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="min-w-0 flex-1 text-left"
      >
        {food ? (
          <>
            <div className="flex items-center gap-1.5">
              {food.dataType === "AI" && (
                <Sparkles className="h-3 w-3 shrink-0 text-foreground/60" />
              )}
              <p className="truncate text-sm font-medium">
                {displayFoodName(food)}
              </p>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {food.brand ? `${food.brand} · ` : ""}
              {dataTypeLabel(food.dataType)}
              {row.gramsDetail ? ` · ${row.gramsDetail}` : ""}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <TriangleAlert className="h-3 w-3 shrink-0 text-muted-foreground" />
              <p className="truncate text-sm font-medium text-foreground/70">
                {rawLabel(row.parsed)}
              </p>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {row.candidates.length > 0
                ? "Not sure which food this is — tap to pick one."
                : "Couldn't find this food — it won't be logged."}
            </p>
          </>
        )}
      </button>

      {food && (
        <>
          <div className="flex shrink-0 items-center gap-0.5">
            <Input
              value={shown}
              inputMode="decimal"
              aria-label={`Grams of ${food.name}`}
              onChange={(e) => {
                setGramsText(e.target.value);
                onEditGrams(
                  parseFiniteNumber(e.target.value, { min: 0 }) ?? 0
                );
              }}
              className="h-8 w-14 rounded-lg px-1.5 text-right text-sm tabular-nums"
            />
            <span className="text-[11px] text-muted-foreground">g</span>
          </div>

          <div className="w-10 shrink-0 text-right">
            <div className="text-sm font-semibold tabular-nums">
              {Math.round(kcalOf(row))}
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              kcal
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Mounted only while open — a closed dialog still builds its whole
          element tree, and there is one of these per row. */}
      {picking && (
        <MatchDialog
          open
          onOpenChange={setPicking}
          row={row}
          onPick={(f) => {
            onPickMatch(f);
            setPicking(false);
          }}
        />
      )}
    </li>
  );
}

function MatchDialog({
  open,
  onOpenChange,
  row,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: Row;
  onPick: (food: SearchFood | null) => void;
}) {
  // The AI estimate sits last, as it does everywhere else in the app —
  // it's the answer when the databases have none.
  const options: SearchFood[] = [
    ...row.candidates,
    ...(row.aiPreview ? [row.aiPreview] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogTitle className="text-base font-semibold">
          Which one is it?
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          You wrote &ldquo;{rawLabel(row.parsed)}&rdquo;.
        </DialogDescription>

        <ul className="mt-4 space-y-2">
          {options.map((f, i) => {
            const active = f === row.chosen;
            return (
              <li key={`${f.fdcId}-${i}`}>
                <button
                  type="button"
                  onClick={() => onPick(f)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
                    active
                      ? "border-foreground bg-accent/40"
                      : "border-border/60 hover:border-border"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {displayFoodName(f)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {f.brand ? `${f.brand} · ` : ""}
                      {dataTypeLabel(f.dataType)}
                      {f.servingSizeG
                        ? ` · ${formatGrams(f.servingSizeG)} g ${
                            f.servingLabel
                              ? extractUnitName(f.servingLabel)
                              : "serving"
                          }`
                        : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      {Math.round(f.per100g.kcal)}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      /100g
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {options.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing to choose from — drop this one and add it from search
            instead.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <DialogClose
            render={<Button variant="ghost" className="flex-1 rounded-full" />}
          >
            Close
          </DialogClose>
          {row.chosen && (
            <Button
              variant="ghost"
              onClick={() => onPick(null)}
              className="flex-1 rounded-full text-muted-foreground"
            >
              None of these
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
