"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  Dumbbell,
  EyeOff,
  Footprints,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Watch,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricBadge } from "@/components/metric-badge";
import { metricColor } from "@/lib/metric-colors";
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
import { cn, parseOptionalInt } from "@/lib/utils";
import { clearActivity, upsertActivity } from "@/app/actions/activity";
import { setWidgetState } from "@/app/actions/widgets";
import { HealthTodayStats } from "@/components/health-today-stats";
import type { ActivityMode } from "@/lib/tdee";

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
  /** Day being edited. `null`/omitted means today. */
  dayKey?: string | null;
};

export function ActivityCard({
  today,
  defaults,
  dayKey = null,
}: ActivityCardProps) {
  const [open, setOpen] = useState(false);
  const logged = today != null;

  return (
    <>
      <Card className="rounded-3xl border-border/60 p-6 shadow-card-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MetricBadge icon={Activity} color={metricColor.activity} />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Today&apos;s activity
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Activity options"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-expanded:bg-muted"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
              <DropdownMenuItem
                onClick={() => setTimeout(() => setOpen(true), 0)}
                className="cursor-pointer rounded-lg text-sm"
              >
                {logged ? (
                  <>
                    <Pencil className="mr-2 h-3.5 w-3.5 opacity-70" />
                    Edit today&apos;s log
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-3.5 w-3.5 opacity-70" />
                    Log today
                  </>
                )}
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
                    await clearActivity(dayKey);
                  }}
                  className="cursor-pointer rounded-lg text-sm"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Clear today&apos;s log
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3">
          {/* Live "so far today" from Health Connect (today, native app only). */}
          {dayKey == null && <HealthTodayStats />}
          {logged ? (
            <ActivitySummary today={today!} />
          ) : (
            <p className="text-sm text-foreground/80">
              Using your typical-day estimate.
              <span className="ml-1 text-muted-foreground">
                Log today&apos;s actual activity before bed for an accurate TDEE.
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
        dayKey={dayKey}
      />
    </>
  );
}

function ActivitySummary({
  today,
}: {
  today: NonNullable<ActivityCardProps["today"]>;
}) {
  if (today.mode === "override") {
    return (
      <div className="flex items-center gap-2">
        <Watch className="h-3.5 w-3.5 text-muted-foreground" />
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

  const chips: { icon: typeof Footprints; text: string }[] = [];
  if (today.steps && today.steps > 0) {
    chips.push({
      icon: Footprints,
      text: `${today.steps.toLocaleString()} steps`,
    });
  }
  if (today.liftingMin && today.liftingMin > 0) {
    chips.push({
      icon: Dumbbell,
      text: `${today.liftingMin}m lift`,
    });
  }
  if (today.cardioMin && today.cardioMin > 0) {
    chips.push({
      icon: Dumbbell,
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
          <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
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
  dayKey,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  today: ActivityCardProps["today"];
  defaults: ActivityCardProps["defaults"];
  dayKey: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        {/* key forces a remount each time the dialog opens so all form
            fields reinitialize from today/defaults without a reset(). */}
        <LogActivityForm
          key={open ? "open" : "closed"}
          today={today}
          defaults={defaults}
          dayKey={dayKey}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function LogActivityForm({
  today,
  defaults,
  dayKey,
  onSaved,
}: {
  today: ActivityCardProps["today"];
  defaults: ActivityCardProps["defaults"];
  dayKey: string | null;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<ActivityMode>(today?.mode ?? "estimate");
  const [steps, setSteps] = useState<string>(() =>
    today?.steps != null
      ? String(today.steps)
      : defaults.stepsPerDay != null
      ? String(defaults.stepsPerDay)
      : ""
  );
  const [liftingMin, setLiftingMin] = useState<string>(() =>
    today?.liftingMin != null ? String(today.liftingMin) : ""
  );
  const [cardioMin, setCardioMin] = useState<string>(() =>
    today?.cardioMin != null ? String(today.cardioMin) : ""
  );
  const [wearableKcal, setWearableKcal] = useState<string>(() =>
    today?.wearableKcal != null
      ? String(today.wearableKcal)
      : defaults.activeKcalOverride != null
      ? String(defaults.activeKcalOverride)
      : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
          onSaved();
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
        onSaved();
      } catch {
        setError("Couldn't save. Try again.");
      }
    });
  }

  return (
    <>
      <DialogTitle className="text-base font-semibold">
        Log today&apos;s activity
      </DialogTitle>
      <DialogDescription className="text-xs text-muted-foreground">
        Updates today&apos;s TDEE for an accurate calorie target.
      </DialogDescription>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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
            render={<Button variant="ghost" className="flex-1 rounded-full" />}
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
    </>
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
        className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
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
