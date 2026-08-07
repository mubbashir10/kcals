"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  Dumbbell,
  EyeOff,
  Flame,
  Footprints,
  HeartPulse,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Watch,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { looseInt, parseOptionalInt } from "@/lib/utils";
import { activeKcal } from "@/lib/tdee";
import { clearActivity, upsertActivity } from "@/app/actions/activity";
import { setWidgetState } from "@/app/actions/widgets";

// Every icon on this card is the same size and carries its own colour — no
// chips, no tinted backgrounds. The card is the only surface here.
const ICON = "h-4 w-4 shrink-0";

export type ActivityCardProps = {
  today: {
    steps: number | null;
    liftingMin: number | null;
    cardioMin: number | null;
    /** A supplied total — synced or typed. Wins over the three above. */
    activeKcal: number | null;
    /** Typed in by hand — Health Connect will not overwrite it. */
    manual: boolean;
    /** App the sync credited, e.g. "Mi Fitness". Null on manual entries. */
    source: string | null;
  } | null;
  /**
   * The day's active energy, as already derived for the burn — passed in
   * rather than worked out here so this card and the maintenance breakdown
   * can't print two different numbers for one day. Only read when the movement
   * above is what the day is running on.
   */
  activeBurnKcal: number;
  /** Profile numbers the form prefills and estimates with. */
  defaults: { stepsPerDay: number | null; weightKg: number };
  /** Day being edited. `null`/omitted means today. */
  dayKey?: string | null;
};

export function ActivityCard({
  today,
  activeBurnKcal,
  defaults,
  dayKey = null,
}: ActivityCardProps) {
  const [open, setOpen] = useState(false);
  const logged = today != null;
  // `dayKey` is null on the home page (today) and a specific day elsewhere.
  const isToday = dayKey == null;

  return (
    <>
      <Card className="rounded-3xl border-border/60 p-6 shadow-card-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={ICON} style={{ color: metricColor.activity }} />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {isToday ? "Today's activity" : "Activity"}
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
                    {isToday ? "Edit today's log" : "Edit log"}
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-3.5 w-3.5 opacity-70" />
                    {isToday ? "Log today" : "Log activity"}
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
                  {isToday ? "Clear today's log" : "Clear log"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3">
          {logged ? (
            <ActivitySummary today={today!} activeBurnKcal={activeBurnKcal} />
          ) : (
            <p className="text-sm text-foreground/80">
              Running on your typical day.
              <span className="ml-1 text-muted-foreground">
                {isToday
                  ? "It'll switch over as soon as your watch syncs, or you can enter today yourself."
                  : "Enter what this day actually was to correct it."}
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

// One movement metric: colored icon, caption, big tabular number, unit. Two of
// these sit side by side when a day has a supplied total and steps to go with it.
function StatTile({
  icon: Icon,
  color,
  value,
  unit,
  label,
  approx,
}: {
  icon: typeof Flame;
  color: string;
  value: number;
  unit: string;
  label: string;
  /** Worked out from movement rather than handed to us — say so with a ~. */
  approx?: boolean;
}) {
  return (
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <Icon className={ICON} style={{ color }} />
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums">
          {approx && (
            <span className="mr-0.5 text-lg font-normal text-muted-foreground">
              ~
            </span>
          )}
          {value.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function ActivitySummary({
  today,
  activeBurnKcal,
}: {
  today: NonNullable<ActivityCardProps["today"]>;
  activeBurnKcal: number;
}) {
  // A supplied total is the day's headline; the steps beside it are context,
  // not another term. Without one, the movement chips carry the day.
  if (today.activeKcal != null) {
    const kcal = today.activeKcal;
    const steps = today.steps ?? 0;
    // The energy tile always shows, even at zero. A supplied zero is what the
    // day's burn is actually running on, and hiding it behind a step count that
    // isn't driving anything is how you get "8,000 steps" over a BMR-only
    // target with nothing on screen explaining the gap.
    const tiles = [
      {
        icon: Flame,
        color: metricColor.energy,
        value: kcal,
        unit: "kcal",
        label: "Active energy",
      },
      ...(steps > 0
        ? [
            {
              icon: Footprints,
              color: metricColor.activity,
              value: steps,
              unit: "steps",
              label: "Steps",
            },
          ]
        : []),
    ];
    return (
      <div>
        <div className="flex gap-6">
          {tiles.map((t) => (
            <StatTile key={t.label} {...t} />
          ))}
        </div>
        <Provenance today={today} />
      </div>
    );
  }

  const chips: { icon: typeof Footprints; color: string; text: string }[] = [];
  if (today.steps && today.steps > 0) {
    chips.push({
      icon: Footprints,
      color: metricColor.activity,
      text: `${today.steps.toLocaleString()} steps`,
    });
  }
  if (today.liftingMin && today.liftingMin > 0) {
    chips.push({
      icon: Dumbbell,
      color: metricColor.energy,
      text: `${today.liftingMin}m lift`,
    });
  }
  if (today.cardioMin && today.cardioMin > 0) {
    chips.push({
      icon: HeartPulse,
      color: metricColor.calendar,
      text: `${today.cardioMin}m cardio`,
    });
  }

  // chips.length === 0 isn't reachable: `dayActivity` in day-dashboard.tsx only
  // passes `today` for a day carrying activity of its own. A lazily-created
  // empty row gets the "Running on your typical day" copy instead.
  //
  // The headline is what this movement cost, same as a supplied day gets — the
  // chips below are what it was worked out from. Without it the card listed
  // inputs and left their one consequence, the number the day's target moves
  // on, to be found on another card.
  return (
    <div>
      <StatTile
        icon={Flame}
        color={metricColor.energy}
        value={activeBurnKcal}
        unit="kcal"
        label="Active energy"
        approx
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {chips.map((c, i) => (
          <span key={i} className="flex items-center gap-2 text-sm tabular-nums">
            <c.icon className={ICON} style={{ color: c.color }} />
            {c.text}
          </span>
        ))}
      </div>
      <Provenance today={today} />
    </div>
  );
}

// Where the day's numbers came from. A hand-entered day says so, because that
// is also what stops Health Connect from rewriting it — the rule is invisible
// otherwise, and "why didn't my steps update?" is the obvious next question.
function Provenance({
  today,
}: {
  today: NonNullable<ActivityCardProps["today"]>;
}) {
  return (
    <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground/70">
      {today.manual ? (
        <>
          <Pencil className={ICON} />
          Logged by hand — Health Connect won&apos;t change it. Clear the log to
          hand this day back.
        </>
      ) : (
        <>
          <Watch className={ICON} />
          Synced from {today.source ?? "your band"}
        </>
      )}
    </p>
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

// A day's burn is either worked out from movement or handed to us as a total —
// never both. The form asks which first, because as one long list the calorie
// field sat under the movement fields and silently overrode them: four filled-in
// inputs, three of which quietly did nothing.
type BurnSource = "activity" | "total";

const SOURCES: { value: BurnSource; label: string }[] = [
  { value: "activity", label: "From activity" },
  { value: "total", label: "Enter a total" },
];

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
  const [source, setSource] = useState<BurnSource>(() =>
    today?.activeKcal != null ? "total" : "activity"
  );
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
  // Named for its side of the toggle, not the column it lands in — `activeKcal`
  // is the estimator this form also calls.
  const [totalKcal, setTotalKcal] = useState<string>(() =>
    today?.activeKcal != null ? String(today.activeKcal) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(input: Parameters<typeof upsertActivity>[1]) {
    startTransition(async () => {
      try {
        await upsertActivity(dayKey, input);
        onSaved();
      } catch {
        setError("Couldn't save. Try again.");
      }
    });
  }

  function onSave() {
    setError(null);
    if (source === "total") {
      const k = parseOptionalInt(totalKcal, 10000);
      if (k === "invalid") {
        setError("Active calories must be between 0 and 10,000.");
        return;
      }
      if (k == null) {
        setError("Enter a total, or switch to From activity.");
        return;
      }
      // The steps come along untouched: a synced day carries both, and
      // correcting the total shouldn't wipe the count shown beside it. The
      // workout minutes don't — nothing reads or shows them once a total is
      // the day's burn.
      save({
        steps: today?.steps ?? null,
        liftingMin: null,
        cardioMin: null,
        activeKcal: k,
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
    save({ steps: s, liftingMin: lm, cardioMin: cm, activeKcal: null });
  }

  // What the movement on screen is worth, live — the same function the day's
  // burn is derived with, so the number promised here is the number saved.
  const estimate = activeKcal({
    weightKg: defaults.weightKg,
    steps: looseInt(steps, 0, 200000),
    liftingMin: looseInt(liftingMin, 0, 600),
    cardioMin: looseInt(cardioMin, 0, 600),
  });

  return (
    <>
      <DialogTitle className="text-base font-semibold">
        Log today&apos;s activity
      </DialogTitle>
      <DialogDescription className="text-xs text-muted-foreground">
        Sets what today cost you, and the calorie target that follows from it.
      </DialogDescription>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Active burn
          </Label>
          <div className="inline-flex w-full rounded-full bg-muted p-1">
            {SOURCES.map((opt) => {
              const active = source === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSource(opt.value);
                  }}
                  className={
                    "flex-1 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all " +
                    (active
                      ? "bg-background text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {source === "activity" ? (
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
            <p className="flex items-center gap-2.5 rounded-2xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
              <Flame className="h-4 w-4 shrink-0 text-primary" />
              <span>
                {estimate.kcal === 0 ? (
                  "Add steps or workout minutes and we'll work out the burn."
                ) : (
                  <>
                    That&apos;s about{" "}
                    <span className="font-semibold text-foreground tabular-nums">
                      {estimate.kcal.toLocaleString()} kcal
                    </span>{" "}
                    on top of your resting burn.
                  </>
                )}
              </span>
            </p>
          </>
        ) : (
          <>
            <NumberField
              id="activity-kcal"
              label="Active calories"
              suffix="kcal"
              placeholder="450"
              value={totalKcal}
              onChange={setTotalKcal}
            />
            <p className="text-[11px] text-muted-foreground/70">
              The number your watch gives you, used as-is — nothing is estimated
              on top of it.
            </p>
          </>
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
