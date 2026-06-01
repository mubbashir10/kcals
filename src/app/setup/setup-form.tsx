"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, isNextRedirectError, round1 } from "@/lib/utils";
import { inToCm, lbToKg, cmToIn, kgToLb, type Sex, type Units } from "@/lib/bmr";
import type { ActivityMode } from "@/lib/tdee";
import {
  lactationKcal,
  type LactationStatus,
  type LactationStage,
  type LactationBasis,
} from "@/lib/lactation";
import { saveProfile } from "./actions";

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
  lactationStatus: string;
  lactationStage: string | null;
  lactationBasis: string;
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

  const [lactationStatus, setLactationStatus] = useState<LactationStatus>(
    (initial?.lactationStatus as LactationStatus) ?? "none"
  );
  const [lactationStage, setLactationStage] = useState<LactationStage>(
    (initial?.lactationStage as LactationStage) ?? "0-6mo"
  );
  const [lactationBasis, setLactationBasis] = useState<LactationBasis>(
    (initial?.lactationBasis as LactationBasis) ?? "maintain"
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
          // Lactation only applies to female profiles; otherwise force "none".
          lactationStatus: sex === "female" ? lactationStatus : "none",
          lactationStage:
            sex === "female" && lactationStatus !== "none"
              ? lactationStage
              : null,
          lactationBasis: sex === "female" ? lactationBasis : "maintain",
        });
      } catch (err) {
        // redirect() throws on success — ignore it, surface real failures.
        if (!isNextRedirectError(err)) {
          setError("Couldn't save. Please try again.");
        }
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Units */}
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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

      {/* Sex */}
      <div className="space-y-2">
        <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
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

      {/* Adds the energy cost of making milk to maintenance. */}
      {sex === "female" && (
        <div className="space-y-5 pt-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Breastfeeding
            </span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Are you nursing?
            </Label>
            <SegmentedToggle<LactationStatus>
              value={lactationStatus}
              onChange={setLactationStatus}
              fullWidth
              options={[
                { value: "none", label: "No" },
                { value: "exclusive", label: "Exclusively" },
                { value: "partial", label: "Partially" },
              ]}
            />
            <p className="text-[11px] text-muted-foreground/70">
              {lactationStatus === "none"
                ? "Making milk burns extra energy — turn this on and we'll add it to your maintenance calories."
                : lactationStatus === "exclusive"
                ? "Breast milk only — no formula or solids yet."
                : "Combo-feeding (breast + formula/solids) — roughly half the milk, so half the calories."}
            </p>
          </div>

          {lactationStatus !== "none" && (
            <>
              <div className="space-y-2">
                <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Baby&rsquo;s age
                </Label>
                <SegmentedToggle<LactationStage>
                  value={lactationStage}
                  onChange={setLactationStage}
                  fullWidth
                  options={[
                    { value: "0-6mo", label: "0–6 mo" },
                    { value: "6-12mo", label: "6–12 mo" },
                    { value: "12mo+", label: "12+ mo" },
                  ]}
                />
                <p className="text-[11px] text-muted-foreground/70">
                  Milk production — and the calories it costs — tapers as your
                  baby grows and starts solids.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  What&rsquo;s your aim?
                </Label>
                <SegmentedToggle<LactationBasis>
                  value={lactationBasis}
                  onChange={setLactationBasis}
                  fullWidth
                  options={[
                    { value: "maintain", label: "Hold weight" },
                    { value: "iom", label: "Gentle loss" },
                  ]}
                />
                <p className="text-[11px] text-muted-foreground/70">
                  {lactationBasis === "maintain"
                    ? "Covers the full cost of making milk so your weight stays steady. Pick a Lose goal later if you want a deficit."
                    : "Follows the IOM guideline — assumes you gently use up pregnancy fat stores, so it builds in a small daily deficit (first 6 months)."}
                </p>
              </div>

              <p className="rounded-2xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
                We&rsquo;ll add{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  +
                  {lactationKcal({
                    lactationStatus,
                    lactationStage,
                    lactationBasis,
                  }).toLocaleString()}{" "}
                  kcal/day
                </span>{" "}
                to your maintenance calories.
              </p>
            </>
          )}
        </div>
      )}

      {/* Activity — used for maintenance-calorie (TDEE) calculation */}
      <div className="space-y-5 pt-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Activity
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
        >
          {label}
        </Label>
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
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
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
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
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
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
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
        >
          {label}
        </Label>
        {optional && (
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
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


