"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { inToCm, lbToKg, cmToIn, kgToLb } from "@/lib/bmr";
import { saveProfile } from "./actions";

type Sex = "male" | "female";
type Units = "metric" | "imperial";
type ActivityMode = "estimate" | "override";

export type InitialProfile = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  units: Units;
  timezone: string;
  activityMode: ActivityMode;
  stepsPerDay: number | null;
  liftingSessionsPerWeek: number | null;
  liftingMinutesPerSession: number | null;
  cardioSessionsPerWeek: number | null;
  cardioMinutesPerSession: number | null;
  activeKcalOverride: number | null;
} | null;

export function SetupForm({ initial }: { initial: InitialProfile }) {
  const [units, setUnits] = useState<Units>(initial?.units ?? "metric");
  const [sex, setSex] = useState<Sex>(initial?.sex ?? "male");
  // For new profiles, default to whatever the browser thinks we're in. The
  // server stored "UTC" as a placeholder; the picker shows the user the value
  // we'll actually save unless they change it.
  const [timezone, setTimezone] = useState<string>(
    initial?.timezone ?? "UTC"
  );
  useEffect(() => {
    if (initial) return;
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Reading Intl on render would mismatch SSR (host tz) vs client (user tz),
      // so we have to set the state after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (detected) setTimezone(detected);
    } catch {
      // ignore — fall back to "UTC"
    }
  }, [initial]);
  const [age, setAge] = useState<string>(
    initial?.age != null ? String(initial.age) : ""
  );

  // store as strings while editing so we don't fight the user mid-type
  const [heightCm, setHeightCm] = useState<string>(
    initial?.heightCm != null ? String(round1(initial.heightCm)) : ""
  );
  const [heightFt, setHeightFt] = useState<string>(
    initial?.heightCm != null
      ? String(Math.floor(cmToIn(initial.heightCm) / 12))
      : ""
  );
  const [heightIn, setHeightIn] = useState<string>(
    initial?.heightCm != null
      ? String(Math.round(cmToIn(initial.heightCm) % 12))
      : ""
  );
  const [weight, setWeight] = useState<string>(() => {
    if (initial?.weightKg == null) return "";
    return units === "metric"
      ? String(round1(initial.weightKg))
      : String(round1(kgToLb(initial.weightKg)));
  });
  const [bodyFat, setBodyFat] = useState<string>(
    initial?.bodyFatPct != null ? String(initial.bodyFatPct) : ""
  );

  const [activityMode, setActivityMode] = useState<ActivityMode>(
    initial?.activityMode ?? "estimate"
  );
  const [stepsPerDay, setStepsPerDay] = useState<string>(
    initial?.stepsPerDay != null ? String(initial.stepsPerDay) : ""
  );
  const [liftingPerWeek, setLiftingPerWeek] = useState<string>(
    initial?.liftingSessionsPerWeek != null
      ? String(initial.liftingSessionsPerWeek)
      : ""
  );
  const [liftingMin, setLiftingMin] = useState<string>(
    initial?.liftingMinutesPerSession != null
      ? String(initial.liftingMinutesPerSession)
      : ""
  );
  const [cardioPerWeek, setCardioPerWeek] = useState<string>(
    initial?.cardioSessionsPerWeek != null
      ? String(initial.cardioSessionsPerWeek)
      : ""
  );
  const [cardioMin, setCardioMin] = useState<string>(
    initial?.cardioMinutesPerSession != null
      ? String(initial.cardioMinutesPerSession)
      : ""
  );
  const [activeKcal, setActiveKcal] = useState<string>(
    initial?.activeKcalOverride != null
      ? String(initial.activeKcalOverride)
      : ""
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onUnitsChange(next: Units) {
    if (next === units) return;
    // convert weight display so the user sees their existing value in the new units
    const w = parseFloat(weight);
    if (!Number.isNaN(w)) {
      setWeight(
        next === "imperial"
          ? String(round1(kgToLb(w)))
          : String(round1(lbToKg(w)))
      );
    }
    setUnits(next);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const ageNum = parseInt(age, 10);
    if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120) {
      setError("Please enter a valid age (13–120).");
      return;
    }

    let cm: number;
    if (units === "metric") {
      cm = parseFloat(heightCm);
      if (!Number.isFinite(cm) || cm < 100 || cm > 250) {
        setError("Please enter a valid height (100–250 cm).");
        return;
      }
    } else {
      const ft = parseInt(heightFt, 10);
      const inches = heightIn === "" ? 0 : parseFloat(heightIn);
      if (!Number.isFinite(ft) || ft < 3 || ft > 8) {
        setError("Please enter a valid height in feet.");
        return;
      }
      cm = inToCm(ft * 12 + inches);
    }

    const wRaw = parseFloat(weight);
    if (!Number.isFinite(wRaw) || wRaw <= 0) {
      setError("Please enter a valid weight.");
      return;
    }
    const kg = units === "metric" ? wRaw : lbToKg(wRaw);
    if (kg < 30 || kg > 300) {
      setError("Please enter a valid weight (30–300 kg / 66–660 lb).");
      return;
    }

    let bf: number | null = null;
    if (bodyFat.trim() !== "") {
      const bfNum = parseFloat(bodyFat);
      if (!Number.isFinite(bfNum) || bfNum <= 0 || bfNum >= 75) {
        setError("Please enter a valid body-fat % (1–75) or leave it blank.");
        return;
      }
      bf = bfNum;
    }

    // Activity fields
    let steps: number | null = null;
    let lifting: number | null = null;
    let liftingMinNum: number | null = null;
    let cardio: number | null = null;
    let cardioMinNum: number | null = null;
    let activeOverride: number | null = null;

    function parseIntField(
      value: string,
      min: number,
      max: number,
      label: string
    ): number | null | "INVALID" {
      if (value.trim() === "") return null;
      const n = parseInt(value, 10);
      if (!Number.isFinite(n) || n < min || n > max) {
        setError(`Please enter a valid ${label} (${min}–${max.toLocaleString()}) or leave it blank.`);
        return "INVALID";
      }
      return n;
    }

    if (activityMode === "estimate") {
      const s = parseIntField(stepsPerDay, 0, 100000, "step count");
      if (s === "INVALID") return;
      steps = s;

      const l = parseIntField(liftingPerWeek, 0, 21, "session count");
      if (l === "INVALID") return;
      lifting = l;

      const lm = parseIntField(liftingMin, 1, 300, "lifting duration in minutes");
      if (lm === "INVALID") return;
      liftingMinNum = lm;

      const c = parseIntField(cardioPerWeek, 0, 21, "cardio session count");
      if (c === "INVALID") return;
      cardio = c;

      const cm = parseIntField(cardioMin, 1, 300, "cardio duration in minutes");
      if (cm === "INVALID") return;
      cardioMinNum = cm;
    } else {
      const a = parseIntField(activeKcal, 0, 4000, "active-calorie value");
      if (a === "INVALID") return;
      activeOverride = a;
    }

    startTransition(async () => {
      try {
        await saveProfile({
          sex,
          age: ageNum,
          heightCm: round1(cm),
          weightKg: round1(kg),
          bodyFatPct: bf,
          units,
          timezone,
          activityMode,
          stepsPerDay: steps,
          liftingSessionsPerWeek: lifting,
          liftingMinutesPerSession: liftingMinNum,
          cardioSessionsPerWeek: cardio,
          cardioMinutesPerSession: cardioMinNum,
          activeKcalOverride: activeOverride,
        });
      } catch (err) {
        // redirect() throws — Next swallows it. Ignore.
        if (
          err instanceof Error &&
          err.message.includes("NEXT_REDIRECT") === false
        ) {
          setError("Couldn't save. Please try again.");
        }
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Units */}
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Units
        </Label>
        <SegmentedToggle<Units>
          value={units}
          onChange={onUnitsChange}
          options={[
            { value: "metric", label: "Metric" },
            { value: "imperial", label: "Imperial" },
          ]}
        />
      </div>

      {/* Timezone — drives "today" cutoffs, greeting, meal-time display */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Timezone
        </Label>
        <TimezonePicker value={timezone} onChange={setTimezone} />
        <p className="text-[11px] text-muted-foreground/70">
          Every &ldquo;today&rdquo; in the app — meals, greeting, time stamps — runs on this clock.
        </p>
      </div>

      {/* Sex */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Sex
        </Label>
        <SegmentedToggle<Sex>
          value={sex}
          onChange={setSex}
          fullWidth
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
      </div>

      {/* Age */}
      <Field label="Age" htmlFor="age" suffix="years">
        <Input
          id="age"
          inputMode="numeric"
          pattern="\d*"
          placeholder="28"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          required
        />
      </Field>

      {/* Height */}
      {units === "metric" ? (
        <Field label="Height" htmlFor="height" suffix="cm">
          <Input
            id="height"
            inputMode="decimal"
            placeholder="178"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            required
          />
        </Field>
      ) : (
        <div className="space-y-2">
          <Label
            htmlFor="height-ft"
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Height
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Input
                id="height-ft"
                inputMode="numeric"
                placeholder="5"
                value={heightFt}
                onChange={(e) => setHeightFt(e.target.value)}
                required
                className="pr-10"
              />
              <Suffix>ft</Suffix>
            </div>
            <div className="relative">
              <Input
                inputMode="numeric"
                placeholder="10"
                value={heightIn}
                onChange={(e) => setHeightIn(e.target.value)}
                className="pr-10"
              />
              <Suffix>in</Suffix>
            </div>
          </div>
        </div>
      )}

      {/* Weight */}
      <Field
        label="Weight"
        htmlFor="weight"
        suffix={units === "metric" ? "kg" : "lb"}
      >
        <Input
          id="weight"
          inputMode="decimal"
          placeholder={units === "metric" ? "72" : "160"}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          required
        />
      </Field>

      {/* Body Fat */}
      <Field label="Body fat" htmlFor="bf" suffix="%" optional>
        <Input
          id="bf"
          inputMode="decimal"
          placeholder="18"
          value={bodyFat}
          onChange={(e) => setBodyFat(e.target.value)}
        />
      </Field>

      {/* Activity — used for maintenance-calorie (TDEE) calculation */}
      <div className="space-y-5 pt-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Activity
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Source
          </Label>
          <SegmentedToggle<ActivityMode>
            value={activityMode}
            onChange={setActivityMode}
            fullWidth
            options={[
              { value: "estimate", label: "Estimate" },
              { value: "override", label: "From wearable" },
            ]}
          />
          <p className="text-[11px] text-muted-foreground/70">
            {activityMode === "estimate"
              ? "We'll estimate from your steps and workouts."
              : "Use the active-calorie number from your Apple Watch / Whoop / etc."}
          </p>
        </div>

        {activityMode === "estimate" ? (
          <>
            <Field
              label="Daily steps"
              htmlFor="steps"
              suffix="steps"
              optional
            >
              <Input
                id="steps"
                inputMode="numeric"
                placeholder="8,000"
                value={stepsPerDay}
                onChange={(e) => setStepsPerDay(e.target.value)}
              />
            </Field>

            <SessionGroup
              label="Weight training"
              freqId="lifting-freq"
              freqValue={liftingPerWeek}
              onFreqChange={setLiftingPerWeek}
              freqPlaceholder="3"
              durId="lifting-min"
              durValue={liftingMin}
              onDurChange={setLiftingMin}
              durPlaceholder="60"
            />

            <SessionGroup
              label="Cardio"
              freqId="cardio-freq"
              freqValue={cardioPerWeek}
              onFreqChange={setCardioPerWeek}
              freqPlaceholder="2"
              durId="cardio-min"
              durValue={cardioMin}
              onDurChange={setCardioMin}
              durPlaceholder="30"
            />
          </>
        ) : (
          <Field
            label="Active calories"
            htmlFor="active-kcal"
            suffix="kcal/day"
            optional
          >
            <Input
              id="active-kcal"
              inputMode="numeric"
              placeholder="450"
              value={activeKcal}
              onChange={(e) => setActiveKcal(e.target.value)}
            />
          </Field>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="w-full rounded-full shadow-sm"
      >
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}

function SessionGroup({
  label,
  freqId,
  freqValue,
  onFreqChange,
  freqPlaceholder,
  durId,
  durValue,
  onDurChange,
  durPlaceholder,
}: {
  label: string;
  freqId: string;
  freqValue: string;
  onFreqChange: (v: string) => void;
  freqPlaceholder: string;
  durId: string;
  durValue: string;
  onDurChange: (v: string) => void;
  durPlaceholder: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label
          htmlFor={freqId}
          className="text-xs uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </Label>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
          Optional
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <Input
            id={freqId}
            inputMode="numeric"
            placeholder={freqPlaceholder}
            value={freqValue}
            onChange={(e) => onFreqChange(e.target.value)}
            className="pr-14"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] uppercase tracking-wider text-muted-foreground">
            × / week
          </span>
        </div>
        <div className="relative">
          <Input
            id={durId}
            inputMode="numeric"
            placeholder={durPlaceholder}
            value={durValue}
            onChange={(e) => onDurChange(e.target.value)}
            className="pr-14"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] uppercase tracking-wider text-muted-foreground">
            min
          </span>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  suffix,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  suffix?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label
          htmlFor={htmlFor}
          className="text-xs uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </Label>
        {optional && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Optional
          </span>
        )}
      </div>
      <div className="relative">
        {children}
        {suffix && <Suffix>{suffix}</Suffix>}
      </div>
    </div>
  );
}

function Suffix({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  fullWidth,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-full bg-muted p-1",
        fullWidth && "w-full"
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
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
  );
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function TimezonePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (tz: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const zones = useMemo(() => {
    type WithSupportedValuesOf = {
      supportedValuesOf?: (k: "timeZone") => string[];
    };
    const intlAny = Intl as unknown as WithSupportedValuesOf;
    const list = intlAny.supportedValuesOf?.("timeZone") ?? [];
    // Ensure the current value is in the list even if the runtime doesn't list it.
    if (value && !list.includes(value)) return [value, ...list];
    return list;
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter((z) => z.toLowerCase().includes(q));
  }, [zones, query]);

  function pick(tz: string) {
    onChange(tz);
    setOpen(false);
    setQuery("");
  }

  const offsetLabel = useMemo(() => formatTzOffset(value), [value]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate">{value || "Select timezone"}</span>
          {offsetLabel && (
            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
              {offsetLabel}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl p-0 sm:max-w-sm">
          <div className="px-4 pt-4">
            <DialogTitle className="text-base font-semibold">
              Choose timezone
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              We&rsquo;ll use this clock for everything time-related.
            </DialogDescription>
          </div>

          <div className="px-4 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ul className="max-h-[60vh] overflow-y-auto px-2 pb-3 pt-2">
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                No matches.
              </li>
            )}
            {filtered.map((tz) => {
              const selected = tz === value;
              return (
                <li key={tz}>
                  <button
                    type="button"
                    onClick={() => pick(tz)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60",
                      selected && "bg-accent/40"
                    )}
                  >
                    <span className="truncate">{tz}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {formatTzOffset(tz)}
                      </span>
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatTzOffset(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    return name ?? "";
  } catch {
    return "";
  }
}
