"use client";

import { useEffect, useState, useTransition } from "react";
import {
  TrendingDown,
  TrendingUp,
  Minus,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setGoal, setMacroGoal, setTrackKcal } from "@/app/actions/widgets";
import {
  GOAL_PACES,
  GOAL_TYPES,
  PACE_KCAL_PER_DAY,
  PACE_KG_PER_WEEK,
  type GoalPace,
  type GoalType,
} from "@/lib/goal";
import {
  KCAL_PER_G,
  MACROS,
  defaultAutoGrams,
  type Macro,
  type MacroMode,
} from "@/lib/macros";
import { cn } from "@/lib/utils";
import { kgToLb } from "@/lib/bmr";

type MacroState = { mode: MacroMode; g: number | null };

type Props = {
  initial: {
    type: GoalType;
    pace: GoalPace | null;
    trackKcal: number | null;
    tdee: number | null;
    bmr: number | null;
    // The goal's computed daily calorie target (TDEE ± deficit, floored).
    // Used to reconcile custom macros outside Track mode, where the user
    // doesn't type a kcal number directly.
    effectiveTarget: number | null;
    macros: Record<Macro, MacroState>;
  };
  unitsLabel: "kg" | "lb";
};

const TYPE_META: Record<
  GoalType,
  { label: string; hint: string; icon: LucideIcon; accent: string }
> = {
  loss: {
    label: "Lose weight",
    hint: "Eat under your TDEE",
    icon: TrendingDown,
    accent: "text-rose-500",
  },
  maintain: {
    label: "Maintain",
    hint: "Eat at your TDEE",
    icon: Minus,
    accent: "text-sky-500",
  },
  gain: {
    label: "Gain weight",
    hint: "Eat above your TDEE",
    icon: TrendingUp,
    accent: "text-emerald-500",
  },
  track: {
    label: "Just track",
    hint: "Set your own kcal + macros",
    icon: Activity,
    accent: "text-muted-foreground",
  },
};

// Below this delta we treat macros as "matching" the kcal target. 50 kcal
// covers normal rounding (proteins/carbs at 4 kcal/g, fat at 9 — a single
// gram of fat is 9 kcal of slop).
const MACRO_MATCH_TOLERANCE = 50;

export function GoalSettings({ initial, unitsLabel }: Props) {
  const [type, setType] = useState<GoalType>(initial.type);
  const [pace, setPace] = useState<GoalPace | null>(initial.pace);
  const [, startTransition] = useTransition();

  // Macro state lives here, not in MacroEditor: the editor renders in two tree
  // positions (inside TrackEditor vs the non-track card), so switching goal
  // type remounts it. setMacroGoal doesn't revalidate /goal, so a remount would
  // otherwise reset to the stale server-loaded macros and drop unsaved-looking
  // edits. Keeping it on GoalSettings (which survives the type switch) holds it.
  const [macros, setMacros] = useState<Record<Macro, MacroState>>(
    initial.macros
  );

  function updateMacro(macro: Macro, next: MacroState) {
    setMacros((prev) => ({ ...prev, [macro]: next }));
    setMacroGoal(macro, next.mode, next.g).catch(() => {
      // Roll back to the last-loaded value if the action rejects.
      setMacros((prev) => ({ ...prev, [macro]: initial.macros[macro] }));
    });
  }

  function save(nextType: GoalType, nextPace: GoalPace | null) {
    setType(nextType);
    setPace(nextPace);
    startTransition(async () => {
      await setGoal(nextType, nextPace);
    });
  }

  function onTypeClick(next: GoalType) {
    if (next === type) return;
    // When switching into loss/gain without an existing pace, default to
    // moderate — it's the textbook "sustainable" pace and a sensible
    // starting point the user can dial up or down.
    const nextPace =
      next === "loss" || next === "gain" ? pace ?? "moderate" : null;
    save(next, nextPace);
  }

  const showPace = type === "loss" || type === "gain";
  const direction = type === "gain" ? "surplus" : "deficit";
  const belowBmr =
    initial.bmr != null &&
    initial.effectiveTarget != null &&
    initial.effectiveTarget < Math.round(initial.bmr);

  return (
    <div className="space-y-3">
      <section className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Target className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-sm font-medium">Goal type</span>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 shadow-card sm:grid-cols-4">
          {GOAL_TYPES.map((t) => {
            const meta = TYPE_META[t];
            const Icon = meta.icon;
            const active = t === type;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onTypeClick(t)}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-[calc(theme(borderRadius.2xl)-0.25rem)] px-2 py-2 text-center transition-all",
                  active
                    ? "bg-background text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  className={cn("h-3.5 w-3.5", meta.accent)}
                />
                <span className="text-[11px] font-medium leading-none">
                  {meta.label}
                </span>
                <span
                  className={cn(
                    "hidden text-[9px] leading-none sm:block",
                    active
                      ? "text-muted-foreground"
                      : "text-muted-foreground/70"
                  )}
                >
                  {meta.hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {showPace && (
        <Card className="space-y-2 rounded-2xl border-border/60 p-3 shadow-card">
          <div className="px-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Pace
          </div>
          <div className="space-y-1.5">
            {GOAL_PACES.map((p) => {
              const kcal = PACE_KCAL_PER_DAY[p];
              const kg = PACE_KG_PER_WEEK[p];
              const perWeek =
                unitsLabel === "kg"
                  ? `${kg} kg/wk`
                  : `${kgToLb(kg).toFixed(2)} lb/wk`;
              const active = p === pace;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => save(type, p)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all",
                    active
                      ? "bg-foreground text-background"
                      : "text-foreground/80 hover:bg-accent/40 hover:text-foreground"
                  )}
                >
                  <div>
                    <div className="text-sm font-medium capitalize">{p}</div>
                    <div
                      className={cn(
                        "text-[11px]",
                        active ? "text-background/70" : "text-muted-foreground"
                      )}
                    >
                      ~{perWeek}
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="text-sm font-semibold">
                      {type === "gain" ? "+" : "−"}
                      {kcal}
                    </div>
                    <div
                      className={cn(
                        "text-[11px] font-medium uppercase tracking-[0.14em]",
                        active ? "text-background/70" : "text-muted-foreground"
                      )}
                    >
                      kcal/day
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="px-1 pt-1 text-[11px] text-muted-foreground/80">
            {TYPE_META[type].hint}. Your calorie target adjusts by the chosen{" "}
            {direction}.
          </p>
          {belowBmr && <BelowBmrNote bmr={initial.bmr!} />}
        </Card>
      )}

      {type === "maintain" && initial.tdee != null && (
        <MaintainCard tdee={initial.tdee} />
      )}

      {type === "track" ? (
        <TrackEditor
          initialKcal={initial.trackKcal}
          macros={macros}
          onMacroChange={updateMacro}
        />
      ) : (
        <Card className="rounded-2xl border-border/60 p-4 shadow-card">
          <MacroEditor
            macros={macros}
            onMacroChange={updateMacro}
            kcalTarget={initial.effectiveTarget}
          />
        </Card>
      )}
    </div>
  );
}

// Eating under resting burn isn't a hard danger line — the body spends well
// above BMR across a day — so this informs rather than blocks or clamps.
function BelowBmrNote({ bmr }: { bmr: number }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-500/[0.07] px-2.5 py-2 text-[11px] leading-relaxed text-amber-600/90 dark:text-amber-400/90">
      <Info className="mt-px h-3 w-3 shrink-0" />
      <span>
        This puts your target under your{" "}
        <span className="font-medium tabular-nums">
          {Math.round(bmr).toLocaleString()}
        </span>{" "}
        kcal resting burn. Common at a fast pace, but a gentler one is easier to
        hold and protects muscle.
      </span>
    </p>
  );
}

function MaintainCard({ tdee }: { tdee: number }) {
  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">Maintenance</span>
        <span className="ml-auto rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Hold steady
        </span>
      </div>
      <div className="mt-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Daily target
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums tracking-tight">
            {Math.round(tdee).toLocaleString()}
          </span>
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            kcal
          </span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground/80">
        Eat about this much each day to hold your current weight. Based on your
        BMR + activity.
      </p>
    </Card>
  );
}

function TrackEditor({
  initialKcal,
  macros,
  onMacroChange,
}: {
  initialKcal: number | null;
  macros: Record<Macro, MacroState>;
  onMacroChange: (macro: Macro, next: MacroState) => void;
}) {
  const [kcal, setKcal] = useState<string>(
    initialKcal != null ? String(initialKcal) : ""
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const trimmedKcal = kcal.trim();
  const parsedKcal =
    trimmedKcal === "" ? null : parseInt(trimmedKcal, 10);
  const kcalInvalid =
    trimmedKcal !== "" &&
    (parsedKcal == null ||
      !Number.isFinite(parsedKcal) ||
      parsedKcal < 800 ||
      parsedKcal > 8000);
  const kcalError = saveError
    ?? (kcalInvalid ? "Enter a number between 800 and 8000." : null);

  // Debounce kcal writes so we don't slam the action on every keystroke.
  useEffect(() => {
    if (trimmedKcal === "") {
      const t = setTimeout(() => {
        setTrackKcal(null).catch(() => setSaveError("Couldn't save"));
      }, 500);
      return () => clearTimeout(t);
    }
    if (kcalInvalid || parsedKcal == null) return;
    const t = setTimeout(() => {
      setTrackKcal(parsedKcal).catch(() => setSaveError("Couldn't save"));
    }, 500);
    return () => clearTimeout(t);
  }, [trimmedKcal, parsedKcal, kcalInvalid]);

  const kcalTarget =
    parsedKcal != null && Number.isFinite(parsedKcal) ? parsedKcal : null;

  return (
    <Card className="space-y-4 rounded-2xl border-border/60 p-4 shadow-card">
      <div>
        <label
          htmlFor="track-kcal"
          className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
        >
          Daily calorie target
        </label>
        <div className="relative">
          <Input
            id="track-kcal"
            inputMode="numeric"
            placeholder="2000"
            value={kcal}
            onChange={(e) => {
              setKcal(e.target.value);
              setSaveError(null);
            }}
            className="h-10 pr-12 text-base tabular-nums"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            kcal
          </span>
        </div>
        {kcalError ? (
          <p className="mt-1.5 text-[11px] text-destructive">{kcalError}</p>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted-foreground/70">
            Leave blank to fall back to your TDEE.
          </p>
        )}
      </div>

      <MacroEditor
        macros={macros}
        onMacroChange={onMacroChange}
        kcalTarget={kcalTarget}
      />
    </Card>
  );
}

// The auto/custom/off macro editor + reconciliation. Shared across every goal
// type: in Track mode it reconciles against the kcal the user typed; in
// loss/maintain/gain it reconciles against the goal's computed target. The
// underlying macro fields live on Profile and apply regardless of goal type,
// so editing here always feeds the dashboard's macro rings. State is owned by
// GoalSettings so it survives the remount when the goal type switches.
function MacroEditor({
  macros,
  onMacroChange,
  kcalTarget,
}: {
  macros: Record<Macro, MacroState>;
  onMacroChange: (macro: Macro, next: MacroState) => void;
  kcalTarget: number | null;
}) {
  const macroKcal = (MACROS as readonly Macro[]).reduce((sum, m) => {
    const { mode, g } = macros[m];
    if (mode !== "custom" || g == null) return sum;
    return sum + g * KCAL_PER_G[m];
  }, 0);
  const allCustom = (MACROS as readonly Macro[]).every(
    (m) => macros[m].mode === "custom" && macros[m].g != null
  );
  const diff =
    kcalTarget != null && allCustom ? macroKcal - kcalTarget : null;
  const matches = diff != null && Math.abs(diff) <= MACRO_MATCH_TOLERANCE;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2 px-1">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Macros
          </div>
          <p className="mt-1 max-w-md text-[11px] leading-relaxed text-muted-foreground/75">
            Auto uses a 30 / 40 / 30 split. Choose custom only for macros you
            want to lock.
          </p>
        </div>
        {kcalTarget != null && (
          <div className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
            {kcalTarget.toLocaleString()} kcal target
          </div>
        )}
      </div>
      <div className="divide-y divide-border/60">
        {MACROS.map((m) => (
          <MacroRow
            key={m}
            macro={m}
            state={macros[m]}
            kcalTarget={kcalTarget}
            onChange={(next) => onMacroChange(m, next)}
          />
        ))}
      </div>
      <Reconciliation
        kcalTarget={kcalTarget}
        macroKcal={macroKcal}
        allCustom={allCustom}
        diff={diff}
        matches={matches}
      />
    </div>
  );
}

function MacroRow({
  macro,
  state,
  kcalTarget,
  onChange,
}: {
  macro: Macro;
  state: MacroState;
  kcalTarget: number | null;
  onChange: (next: MacroState) => void;
}) {
  const [grams, setGrams] = useState<string>(
    state.g != null ? String(state.g) : ""
  );
  const suggested =
    kcalTarget != null ? defaultAutoGrams(macro, kcalTarget) : null;
  const customReady = state.mode === "custom" && state.g != null;

  function pickMode(next: MacroMode) {
    if (next === state.mode) return;
    const g = next === "custom" ? parseGrams(grams) : null;
    onChange({ mode: next, g });
  }

  function onGramsChange(next: string) {
    setGrams(next);
    if (state.mode !== "custom") return;
    const g = parseGrams(next);
    onChange({ mode: "custom", g });
  }

  return (
    <div className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn("h-2 w-2 rounded-full", MACRO_DOT_CLASS[macro])}
            aria-hidden
          />
          <span className="text-sm font-medium capitalize">{macro}</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {state.mode === "auto" && suggested != null
              ? `${suggested}g auto`
              : state.mode === "custom" && customReady
                ? `${state.g}g locked`
                : state.mode === "off"
                  ? "not tracked"
                  : "set grams"}
          </span>
        </div>
        {state.mode === "custom" && (
          <div className="relative mt-2 max-w-44">
            <Input
              inputMode="numeric"
              placeholder={suggested != null ? String(suggested) : "grams"}
              value={grams}
              onChange={(e) => onGramsChange(e.target.value)}
              className="h-9 rounded-full pr-9 text-sm tabular-nums"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
              g
            </span>
          </div>
        )}
      </div>

      <div className="inline-flex w-full rounded-full bg-muted/60 p-0.5 sm:w-auto">
          {(["auto", "custom", "off"] as MacroMode[]).map((opt) => {
            const active = state.mode === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => pickMode(opt)}
                className={cn(
                  "min-w-0 flex-1 rounded-full px-3 py-1.5 text-[11px] font-medium capitalize transition-all sm:flex-none",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt}
              </button>
            );
          })}
      </div>
    </div>
  );
}

const MACRO_DOT_CLASS: Record<Macro, string> = {
  protein: "bg-sky-400",
  carbs: "bg-emerald-400",
  fat: "bg-amber-400",
};

function Reconciliation({
  kcalTarget,
  macroKcal,
  allCustom,
  diff,
  matches,
}: {
  kcalTarget: number | null;
  macroKcal: number;
  allCustom: boolean;
  diff: number | null;
  matches: boolean;
}) {
  if (kcalTarget == null) {
    return (
      <p className="px-1 text-[11px] text-muted-foreground/70">
        Set a calorie target above to compare against your macros.
      </p>
    );
  }
  if (!allCustom) {
    return (
      <p className="px-1 text-[11px] text-muted-foreground/70">
        Set all three macros to <span className="font-medium">custom</span> to
        see how they line up with your kcal target.
      </p>
    );
  }
  if (matches) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>
          Macros total <span className="font-semibold tabular-nums">
            {macroKcal}
          </span>{" "}
          kcal — matches your target.
        </span>
      </div>
    );
  }
  const overUnder = (diff ?? 0) > 0 ? "over" : "under";
  return (
    <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Macros total{" "}
        <span className="font-semibold tabular-nums">{macroKcal}</span> kcal —{" "}
        <span className="font-semibold tabular-nums">
          {Math.abs(diff ?? 0)}
        </span>{" "}
        kcal {overUnder} your target. We won&rsquo;t stop you, just a heads-up.
      </span>
    </div>
  );
}

function parseGrams(s: string): number | null {
  const n = parseInt(s.trim(), 10);
  if (!Number.isFinite(n) || n < 0 || n >= 2000) return null;
  return n;
}
