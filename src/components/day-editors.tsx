"use client";

import { useState, useTransition } from "react";
import {
  Dumbbell,
  Flame,
  Footprints,
  Pencil,
  Plus,
  Scale,
  Trash2,
  Watch,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricBadge } from "@/components/metric-badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, parseOptionalInt } from "@/lib/utils";
import { displayWeight, lbToKg, unitLabel, type Units } from "@/lib/bmr";
import { metricColor } from "@/lib/metric-colors";
import type { ActivityMode } from "@/lib/tdee";
import { logWeight, deleteWeightLog, updateWeightLog } from "@/app/actions/weight";
import { clearActivity, upsertActivity } from "@/app/actions/activity";

// ─── Weight ──────────────────────────────────────────────────────────────

export function DayWeightTile({
  weightKg,
  logId,
  units,
  dayKey,
}: {
  weightKg: number | null;
  logId: number | null;
  units: Units;
  dayKey: string;
}) {
  const [open, setOpen] = useState(false);
  const display = weightKg != null ? displayWeight(weightKg, units) : null;

  return (
    <>
      <Card className="rounded-2xl border-border/60 p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <MetricBadge icon={Scale} color={metricColor.weight} />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Weight
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={weightKg != null ? "Edit weigh-in" : "Log weight"}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {weightKg != null ? (
              <Pencil className="h-3 w-3" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 block text-left outline-none"
        >
          <div className="text-2xl font-semibold leading-none tabular-nums tracking-tight">
            {display != null ? (
              <>
                {display.value}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {display.unit}
                </span>
              </>
            ) : (
              <span className="text-base font-normal text-muted-foreground">
                Tap to log
              </span>
            )}
          </div>
        </button>
      </Card>

      <WeightDialog
        open={open}
        onOpenChange={setOpen}
        weightKg={weightKg}
        logId={logId}
        units={units}
        dayKey={dayKey}
      />
    </>
  );
}

function WeightDialog({
  open,
  onOpenChange,
  weightKg,
  logId,
  units,
  dayKey,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  weightKg: number | null;
  logId: number | null;
  units: Units;
  dayKey: string;
}) {
  const initialDisplay =
    weightKg != null ? displayWeight(weightKg, units).value : "";
  const [value, setValue] = useState(initialDisplay);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletePending, startDelete] = useTransition();

  function onOpen(next: boolean) {
    if (next) {
      setValue(initialDisplay);
      setError(null);
    }
    onOpenChange(next);
  }

  function onSave() {
    setError(null);
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num <= 0) {
      setError("Please enter a valid weight.");
      return;
    }
    const kg = units === "metric" ? num : lbToKg(num);
    if (kg < 30 || kg > 300) {
      setError("Enter a weight between 30–300 kg (66–660 lb).");
      return;
    }
    startTransition(async () => {
      try {
        if (logId != null) {
          await updateWeightLog(logId, kg);
        } else {
          await logWeight(kg, dayKey);
        }
        onOpenChange(false);
      } catch {
        setError("Couldn't save. Try again.");
      }
    });
  }

  function onRemove() {
    if (logId == null) return;
    startDelete(async () => {
      try {
        await deleteWeightLog(logId);
        onOpenChange(false);
      } catch {
        setError("Couldn't remove. Try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogTitle className="text-base font-semibold">
          {logId != null ? "Edit weigh-in" : "Log weight"}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Recorded for this day.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="day-weight-input"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Weight
            </Label>
            <div className="relative">
              <Input
                id="day-weight-input"
                inputMode="decimal"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="pr-12 text-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSave();
                  }
                }}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">
                {unitLabel(units)}
              </span>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex items-center gap-2">
            {logId != null && (
              <Button
                variant="ghost"
                onClick={onRemove}
                disabled={deletePending || pending}
                className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {deletePending ? "Removing…" : "Remove"}
              </Button>
            )}
            <div className="flex-1" />
            <DialogClose
              render={<Button variant="ghost" className="rounded-full" />}
            >
              Cancel
            </DialogClose>
            <Button
              onClick={onSave}
              disabled={pending || deletePending}
              className="rounded-full"
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Activity ────────────────────────────────────────────────────────────

export type DayActivity = {
  mode: ActivityMode;
  steps: number | null;
  liftingMin: number | null;
  cardioMin: number | null;
  wearableKcal: number | null;
} | null;

export type DayActivityDefaults = {
  stepsPerDay: number | null;
  liftingMinutesPerSession: number | null;
  cardioMinutesPerSession: number | null;
  activeKcalOverride: number | null;
};

export function DayActivityTile({
  activity,
  defaults,
  activeKcal,
  hasActivity,
  dayKey,
}: {
  activity: DayActivity;
  defaults: DayActivityDefaults;
  activeKcal: number;
  hasActivity: boolean;
  dayKey: string;
}) {
  const [open, setOpen] = useState(false);
  const steps = activity?.steps ?? null;
  const liftingMin = activity?.liftingMin ?? null;
  const cardioMin = activity?.cardioMin ?? null;
  const wearableKcal = activity?.wearableKcal ?? null;

  return (
    <>
      <Card className="rounded-2xl border-border/60 p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <MetricBadge icon={Zap} color={metricColor.activity} />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Activity
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={hasActivity ? "Edit activity" : "Log activity"}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {hasActivity ? (
              <Pencil className="h-3 w-3" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 block w-full text-left outline-none"
        >
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-semibold leading-none tabular-nums tracking-tight">
              {activeKcal.toLocaleString()}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              active kcal
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted-foreground">
            {!hasActivity ? (
              <span>Estimated from defaults</span>
            ) : wearableKcal != null && wearableKcal > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Watch className="h-3 w-3" />
                From wearable
              </span>
            ) : (
              <>
                {(steps ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Footprints className="h-3 w-3" />
                    {steps!.toLocaleString()} steps
                  </span>
                )}
                {(liftingMin ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Dumbbell className="h-3 w-3" />
                    {liftingMin}m lift
                  </span>
                )}
                {(cardioMin ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    {cardioMin}m cardio
                  </span>
                )}
              </>
            )}
          </div>
        </button>
      </Card>

      <ActivityDialog
        key={open ? "open" : "closed"}
        open={open}
        onOpenChange={setOpen}
        activity={activity}
        defaults={defaults}
        hasActivity={hasActivity}
        dayKey={dayKey}
      />
    </>
  );
}

function ActivityDialog({
  open,
  onOpenChange,
  activity,
  defaults,
  hasActivity,
  dayKey,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  activity: DayActivity;
  defaults: DayActivityDefaults;
  hasActivity: boolean;
  dayKey: string;
}) {
  const [mode, setMode] = useState<ActivityMode>(activity?.mode ?? "estimate");
  const [steps, setSteps] = useState<string>(() =>
    activity?.steps != null
      ? String(activity.steps)
      : defaults.stepsPerDay != null
      ? String(defaults.stepsPerDay)
      : ""
  );
  const [liftingMin, setLiftingMin] = useState<string>(() =>
    activity?.liftingMin != null ? String(activity.liftingMin) : ""
  );
  const [cardioMin, setCardioMin] = useState<string>(() =>
    activity?.cardioMin != null ? String(activity.cardioMin) : ""
  );
  const [wearableKcal, setWearableKcal] = useState<string>(() =>
    activity?.wearableKcal != null
      ? String(activity.wearableKcal)
      : defaults.activeKcalOverride != null
      ? String(defaults.activeKcalOverride)
      : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [clearPending, startClear] = useTransition();

  function onSave() {
    setError(null);
    if (mode === "override") {
      const k = parseOptionalInt(wearableKcal, 10000);
      if (k === "invalid") {
        setError("Enter a kcal value between 0 and 10,000.");
        return;
      }
      startTransition(async () => {
        try {
          await upsertActivity(dayKey, { mode, wearableKcal: k });
          onOpenChange(false);
        } catch {
          setError("Couldn't save. Try again.");
        }
      });
      return;
    }

    const s = parseOptionalInt(steps, 200000);
    const lm = parseOptionalInt(liftingMin, 600);
    const cm = parseOptionalInt(cardioMin, 600);
    if (s === "invalid" || lm === "invalid" || cm === "invalid") {
      setError("One of the values is out of range.");
      return;
    }
    startTransition(async () => {
      try {
        await upsertActivity(dayKey, {
          mode,
          steps: s,
          liftingMin: lm,
          cardioMin: cm,
        });
        onOpenChange(false);
      } catch {
        setError("Couldn't save. Try again.");
      }
    });
  }

  function onClear() {
    startClear(async () => {
      try {
        await clearActivity(dayKey);
        onOpenChange(false);
      } catch {
        setError("Couldn't clear. Try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogTitle className="text-base font-semibold">
          Log activity
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Sets this day&apos;s active calories and TDEE.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <ModeButton
              active={mode === "estimate"}
              onClick={() => setMode("estimate")}
              label="Steps & workouts"
            />
            <ModeButton
              active={mode === "override"}
              onClick={() => setMode("override")}
              label="Wearable kcal"
            />
          </div>

          {mode === "override" ? (
            <div className="space-y-2">
              <Label
                htmlFor="day-wearable"
                className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                Active calories
              </Label>
              <div className="relative">
                <Input
                  id="day-wearable"
                  inputMode="numeric"
                  autoFocus
                  value={wearableKcal}
                  onChange={(e) => setWearableKcal(e.target.value)}
                  placeholder="e.g. 450"
                  className="pr-14 text-lg"
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">
                  kcal
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <ActivityField
                id="day-steps"
                label="Steps"
                value={steps}
                onChange={setSteps}
                placeholder="e.g. 8000"
              />
              <ActivityField
                id="day-lifting"
                label="Lifting"
                unit="min"
                value={liftingMin}
                onChange={setLiftingMin}
                placeholder="0"
              />
              <ActivityField
                id="day-cardio"
                label="Cardio"
                unit="min"
                value={cardioMin}
                onChange={setCardioMin}
                placeholder="0"
              />
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-2">
            {hasActivity && (
              <Button
                variant="ghost"
                onClick={onClear}
                disabled={clearPending || pending}
                className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {clearPending ? "Clearing…" : "Clear"}
              </Button>
            )}
            <div className="flex-1" />
            <DialogClose
              render={<Button variant="ghost" className="rounded-full" />}
            >
              Cancel
            </DialogClose>
            <Button
              onClick={onSave}
              disabled={pending || clearPending}
              className="rounded-full"
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-2 text-xs font-medium transition-all",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border/60 bg-card text-foreground/80 hover:border-border hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function ActivityField({
  id,
  label,
  unit,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
      >
        {label}
      </Label>
      <div className="relative w-32">
        <Input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn("tabular-nums", unit && "pr-10")}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
