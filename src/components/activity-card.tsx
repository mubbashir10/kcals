"use client";

import { useState, useTransition } from "react";
import {
  ChevronUp,
  Dumbbell,
  EyeOff,
  Footprints,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Watch,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WidgetMenu } from "@/components/widget-menu";
import type { WidgetState } from "@/lib/widget-order";
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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  deleteTodayActivity,
  upsertTodayActivity,
  type ActivityMode,
} from "@/app/actions/activity";
import { setWidgetState } from "@/app/actions/widgets";

export type ActivityCardProps = {
  today: {
    mode: ActivityMode;
    steps: number | null;
    liftingMin: number | null;
    cardioMin: number | null;
    wearableKcal: number | null;
  } | null;
  defaults: {
    stepsPerDay: number | null;
    liftingMinutesPerSession: number | null;
    cardioMinutesPerSession: number | null;
    activeKcalOverride: number | null;
  };
  state: Exclude<WidgetState, "hidden">;
};

export function ActivityCard({ today, defaults, state }: ActivityCardProps) {
  const [open, setOpen] = useState(false);
  const logged = today != null;

  if (state === "minimized") {
    return (
      <Card className="rounded-2xl border-border/60 px-5 py-3 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Zap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Activity
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs text-foreground/80">
              {logged ? <MinimizedSummaryText today={today!} /> : "Using estimate"}
            </span>
            <WidgetMenu
              widgetId="activity"
              current="minimized"
              label="Activity"
              size="sm"
            />
          </div>
        </div>

        <LogActivityDialog
          open={open}
          onOpenChange={setOpen}
          today={today}
          defaults={defaults}
        />
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-3xl border-border/60 p-6 shadow-card-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Today's activity
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-7 items-center gap-0.5 rounded-full bg-muted px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
            >
              {logged ? (
                <>
                  <Pencil className="h-3 w-3" />
                  Edit
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3" />
                  Log
                </>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Activity options"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-expanded:bg-muted"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
                <DropdownMenuItem
                  onClick={async () => {
                    await setWidgetState("activity", "minimized");
                  }}
                  className="cursor-pointer rounded-lg text-sm"
                >
                  <ChevronUp className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Minimize
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await setWidgetState("activity", "hidden");
                  }}
                  className="cursor-pointer rounded-lg text-sm"
                >
                  <EyeOff className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Hide
                </DropdownMenuItem>
                {logged && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={async () => {
                      await deleteTodayActivity();
                    }}
                    className="cursor-pointer rounded-lg text-sm"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5 opacity-70" />
                    Clear today's log
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-3">
          {logged ? (
            <ActivitySummary today={today!} />
          ) : (
            <p className="text-sm text-foreground/80">
              Using your typical-day estimate.
              <span className="ml-1 text-muted-foreground">
                Log today's actual activity before bed for an accurate TDEE.
              </span>
            </p>
          )}
        </div>
      </Card>

      <LogActivityDialog
        open={open}
        onOpenChange={setOpen}
        today={today}
        defaults={defaults}
      />
    </>
  );
}

function MinimizedSummaryText({
  today,
}: {
  today: NonNullable<ActivityCardProps["today"]>;
}) {
  if (today.mode === "override") {
    return (
      <>
        {today.wearableKcal != null
          ? `${today.wearableKcal.toLocaleString()} kcal`
          : "—"}{" "}
        <span className="text-muted-foreground">from wearable</span>
      </>
    );
  }
  const parts: string[] = [];
  if (today.steps && today.steps > 0)
    parts.push(`${today.steps.toLocaleString()} steps`);
  if (today.liftingMin && today.liftingMin > 0)
    parts.push(`${today.liftingMin}m lift`);
  if (today.cardioMin && today.cardioMin > 0)
    parts.push(`${today.cardioMin}m cardio`);
  return <>{parts.length === 0 ? "Rest day" : parts.join(" · ")}</>;
}

function ActivitySummary({
  today,
}: {
  today: NonNullable<ActivityCardProps["today"]>;
}) {
  if (today.mode === "override") {
    return (
      <div className="flex items-center gap-2">
        <Watch className="h-3.5 w-3.5 text-emerald-500/80" />
        <span className="text-sm tabular-nums">
          {today.wearableKcal != null
            ? `${today.wearableKcal.toLocaleString()} kcal`
            : "—"}
          <span className="ml-1.5 text-xs text-muted-foreground">
            from wearable
          </span>
        </span>
      </div>
    );
  }

  const chips: { icon: typeof Footprints; color: string; text: string }[] = [];
  if (today.steps && today.steps > 0) {
    chips.push({
      icon: Footprints,
      color: "text-sky-500/80",
      text: `${today.steps.toLocaleString()} steps`,
    });
  }
  if (today.liftingMin && today.liftingMin > 0) {
    chips.push({
      icon: Dumbbell,
      color: "text-amber-500/80",
      text: `${today.liftingMin}m lift`,
    });
  }
  if (today.cardioMin && today.cardioMin > 0) {
    chips.push({
      icon: Dumbbell,
      color: "text-amber-500/80",
      text: `${today.cardioMin}m cardio`,
    });
  }

  // chips.length === 0 isn't reachable: page.tsx only passes `today` when
  // there's an actual override (≥1 non-zero field). An empty snapshot row
  // shows the "Using your typical-day estimate" copy instead.
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {chips.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5 text-sm tabular-nums">
          <c.icon className={cn("h-3.5 w-3.5", c.color)} />
          {c.text}
        </span>
      ))}
    </div>
  );
}

function LogActivityDialog({
  open,
  onOpenChange,
  today,
  defaults,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  today: ActivityCardProps["today"];
  defaults: ActivityCardProps["defaults"];
}) {
  const [mode, setMode] = useState<ActivityMode>(today?.mode ?? "estimate");
  const [steps, setSteps] = useState<string>(
    today?.steps != null
      ? String(today.steps)
      : defaults.stepsPerDay != null
      ? String(defaults.stepsPerDay)
      : ""
  );
  const [liftingMin, setLiftingMin] = useState<string>(
    today?.liftingMin != null
      ? String(today.liftingMin)
      : ""
  );
  const [cardioMin, setCardioMin] = useState<string>(
    today?.cardioMin != null
      ? String(today.cardioMin)
      : ""
  );
  const [wearableKcal, setWearableKcal] = useState<string>(
    today?.wearableKcal != null
      ? String(today.wearableKcal)
      : defaults.activeKcalOverride != null
      ? String(defaults.activeKcalOverride)
      : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setMode(today?.mode ?? "estimate");
    setSteps(
      today?.steps != null
        ? String(today.steps)
        : defaults.stepsPerDay != null
        ? String(defaults.stepsPerDay)
        : ""
    );
    setLiftingMin(today?.liftingMin != null ? String(today.liftingMin) : "");
    setCardioMin(today?.cardioMin != null ? String(today.cardioMin) : "");
    setWearableKcal(
      today?.wearableKcal != null
        ? String(today.wearableKcal)
        : defaults.activeKcalOverride != null
        ? String(defaults.activeKcalOverride)
        : ""
    );
    setError(null);
  }

  function onOpen(next: boolean) {
    if (next) reset();
    onOpenChange(next);
  }

  function parseOptionalInt(v: string, max: number): number | null | "invalid" {
    const trimmed = v.trim();
    if (trimmed === "") return null;
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n < 0 || n > max) return "invalid";
    return n;
  }

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
          await upsertTodayActivity({ mode, wearableKcal: k });
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
        await upsertTodayActivity({
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

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogTitle className="text-base font-semibold">
          Log today's activity
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Updates today's TDEE for an accurate calorie target.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Source
            </Label>
            <div className="inline-flex w-full rounded-full bg-muted p-1">
              {[
                { value: "estimate" as const, label: "Steps + workout" },
                { value: "override" as const, label: "From wearable" },
              ].map((opt) => {
                const active = opt.value === mode;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMode(opt.value)}
                    className={cn(
                      "flex-1 rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === "estimate" ? (
            <>
              <NumberField
                id="activity-steps"
                label="Steps"
                suffix="steps"
                placeholder="8,000"
                value={steps}
                onChange={setSteps}
              />
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  id="activity-lift"
                  label="Lifting"
                  suffix="min"
                  placeholder="0"
                  value={liftingMin}
                  onChange={setLiftingMin}
                />
                <NumberField
                  id="activity-cardio"
                  label="Cardio"
                  suffix="min"
                  placeholder="0"
                  value={cardioMin}
                  onChange={setCardioMin}
                />
              </div>
            </>
          ) : (
            <NumberField
              id="activity-wearable"
              label="Active calories"
              suffix="kcal"
              placeholder="450"
              value={wearableKcal}
              onChange={setWearableKcal}
            />
          )}

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

function NumberField({
  id,
  label,
  suffix,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  suffix: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-xs uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-14"
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}
