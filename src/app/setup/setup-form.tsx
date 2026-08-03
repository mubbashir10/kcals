"use client";

import { useEffect, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Baby,
  CalendarDays,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Mars,
  Percent,
  Ruler,
  Venus,
  Weight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, isNextRedirectError, round1 } from "@/lib/utils";
import {
  BODY_FAT_MAX_PCT,
  BODY_FAT_MIN_PCT,
  cmToIn,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  inToCm,
  kgToLb,
  lbToKg,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
  type Sex,
  type Units,
} from "@/lib/bmr";
import {
  lactationKcal,
  type LactationStatus,
  type LactationStage,
  type LactationBasis,
} from "@/lib/lactation";
import { nudgeMeasurementSync } from "@/lib/native";
import { saveProfile } from "./actions";

export type InitialProfile = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  units: Units;
  timezone: string;
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
      if (!Number.isFinite(cm) || cm < HEIGHT_MIN_CM || cm > HEIGHT_MAX_CM) {
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
    if (kg < WEIGHT_MIN_KG || kg > WEIGHT_MAX_KG) {
      setError("Please enter a valid weight (30–300 kg / 66–660 lb).");
      return;
    }

    let bf: number | null = null;
    if (bodyFat.trim() !== "") {
      const bfNum = parseFloat(bodyFat);
      if (
        !Number.isFinite(bfNum) ||
        bfNum < BODY_FAT_MIN_PCT ||
        bfNum > BODY_FAT_MAX_PCT
      ) {
        setError("Please enter a valid body-fat % (1–75) or leave it blank.");
        return;
      }
      bf = bfNum;
    }

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

    // The typical day. Every field is optional, and every one is read.
    const steps = parseIntField(stepsPerDay, 0, 100000, "step count");
    if (steps === "INVALID") return;

    const lifting = parseIntField(liftingPerWeek, 0, 21, "session count");
    if (lifting === "INVALID") return;

    const liftingMinNum = parseIntField(
      liftingMin,
      1,
      300,
      "lifting duration in minutes"
    );
    if (liftingMinNum === "INVALID") return;

    const cardio = parseIntField(cardioPerWeek, 0, 21, "cardio session count");
    if (cardio === "INVALID") return;

    const cardioMinNum = parseIntField(
      cardioMin,
      1,
      300,
      "cardio duration in minutes"
    );
    if (cardioMinNum === "INVALID") return;

    const activeOverride = parseIntField(
      activeKcal,
      0,
      4000,
      "active-calorie value"
    );
    if (activeOverride === "INVALID") return;

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
          return;
        }
        // Saved — if height/body fat actually changed, push them to Health
        // Connect right away. Other profile edits don't need the full pass.
        if (
          !initial ||
          round1(cm) !== initial.heightCm ||
          bf !== initial.bodyFatPct
        ) {
          nudgeMeasurementSync();
        }
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Units */}
      <div className="flex items-center justify-between">
        <FieldLabel>Units</FieldLabel>
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
        <FieldLabel>Sex</FieldLabel>
        <SegmentedToggle<Sex>
          value={sex}
          onChange={setSex}
          fullWidth
          options={[
            {
              value: "male",
              label: "Male",
              icon: Mars,
              accent: "text-sky-600 dark:text-sky-400",
            },
            {
              value: "female",
              label: "Female",
              icon: Venus,
              accent: "text-rose-600 dark:text-rose-400",
            },
          ]}
        />
      </div>

      {/* Age */}
      <Field label="Age" icon={CalendarDays} htmlFor="age" suffix="years">
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
        <Field label="Height" icon={Ruler} htmlFor="height" suffix="cm">
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
          <FieldLabel icon={Ruler} htmlFor="height-ft">
            Height
          </FieldLabel>
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
        icon={Weight}
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
      <Field label="Body fat" icon={Percent} htmlFor="bf" suffix="%" optional>
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
          <SectionHeader icon={Baby}>Breastfeeding</SectionHeader>

          <div className="space-y-2">
            <FieldLabel>Are you nursing?</FieldLabel>
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
                <FieldLabel>Baby&rsquo;s age</FieldLabel>
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
                <FieldLabel>What&rsquo;s your aim?</FieldLabel>
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

              <p className="flex items-center gap-2.5 rounded-2xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
                <Flame className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  We&rsquo;ll add{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    +
                    {lactationKcal({
                      sex,
                      lactationStatus,
                      lactationStage,
                      lactationBasis,
                    }).toLocaleString()}{" "}
                    kcal/day
                  </span>{" "}
                  to your maintenance calories.
                </span>
              </p>
            </>
          )}
        </div>
      )}

      {/* Activity — the typical day every day starts on */}
      <div className="space-y-5 pt-2">
        <SectionHeader icon={Activity}>Activity</SectionHeader>
        <p className="-mt-2 text-[11px] text-muted-foreground/70">
          Your ordinary week. Every day starts here, and a day only moves off it
          when your watch or your own entry says otherwise.
        </p>

        <Field
          label="Daily steps"
          icon={Footprints}
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
          icon={Dumbbell}
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
          icon={HeartPulse}
          freqId="cardio-freq"
          freqValue={cardioPerWeek}
          onFreqChange={setCardioPerWeek}
          freqPlaceholder="2"
          durId="cardio-min"
          durValue={cardioMin}
          onDurChange={setCardioMin}
          durPlaceholder="30"
        />

        {/* Same rule as a single day: a number here replaces the estimate
            above rather than adding to it. */}
        <div className="space-y-2 border-t border-border/60 pt-5">
          <Field
            label="Active calories"
            icon={Flame}
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
          <p className="text-[11px] text-muted-foreground/70">
            If your watch already tells you a daily average, put it here — it
            replaces everything above. Leave it blank otherwise.
          </p>
        </div>
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
  icon,
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
  icon: LucideIcon;
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
        <FieldLabel icon={icon} htmlFor={freqId}>
          {label}
        </FieldLabel>
        <OptionalTag />
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
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            min
          </span>
        </div>
      </div>
    </div>
  );
}

/** The uppercase, letter-spaced caption used above every control on this form. */
function FieldLabel({
  icon: Icon,
  htmlFor,
  children,
}: {
  icon?: LucideIcon;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
    >
      {Icon && <Icon className="h-3.5 w-3.5 text-primary/70" />}
      {children}
    </Label>
  );
}

function OptionalTag() {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
      Optional
    </span>
  );
}

/** A titled rule that splits the form into sections. */
function SectionHeader({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {children}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function Field({
  label,
  icon,
  htmlFor,
  suffix,
  optional,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  htmlFor: string;
  suffix?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <FieldLabel icon={icon} htmlFor={htmlFor}>
          {label}
        </FieldLabel>
        {optional && <OptionalTag />}
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

type ToggleOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Text/icon colour once this option is selected. Defaults to `text-foreground`. */
  accent?: string;
};

function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  fullWidth,
}: {
  value: T;
  onChange: (next: T) => void;
  options: ToggleOption<T>[];
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
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full",
              "px-4 py-1.5 text-xs font-medium transition-all",
              active
                ? cn("bg-background shadow-sm", opt.accent ?? "text-foreground")
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}


