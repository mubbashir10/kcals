"use client";

import { useState, useTransition } from "react";
import { Baby } from "lucide-react";

import { Card } from "@/components/ui/card";
import { setLactation } from "@/app/actions/widgets";
import {
  LACTATION_STAGES,
  lactationKcal,
  lactationStageLabel,
  type LactationBasis,
  type LactationStage,
  type LactationStatus,
} from "@/lib/lactation";
import { cn } from "@/lib/utils";

type Props = {
  initial: {
    status: LactationStatus;
    stage: LactationStage;
    basis: LactationBasis;
  };
};

const STATUS_OPTIONS: { value: LactationStatus; label: string; hint: string }[] =
  [
    { value: "none", label: "No", hint: "Not breastfeeding right now." },
    {
      value: "exclusive",
      label: "Exclusively",
      hint: "Breast milk only — no formula or solids yet.",
    },
    {
      value: "partial",
      label: "Partially",
      hint: "Combo-feeding — roughly half the milk, so half the calories.",
    },
  ];

const BASIS_OPTIONS: { value: LactationBasis; label: string; hint: string }[] = [
  {
    value: "maintain",
    label: "Hold weight",
    hint: "Covers the full cost of making milk so your weight stays steady. Pick a Lose goal above if you want a deficit.",
  },
  {
    value: "iom",
    label: "Gentle loss",
    hint: "Follows the IOM guideline — assumes you gently use up pregnancy fat stores, building in a small deficit (first 6 months).",
  },
];

export function LactationSettings({ initial }: Props) {
  const [status, setStatus] = useState<LactationStatus>(initial.status);
  const [stage, setStage] = useState<LactationStage>(initial.stage);
  const [basis, setBasis] = useState<LactationBasis>(initial.basis);
  const [, startTransition] = useTransition();

  function save(
    nextStatus: LactationStatus,
    nextStage: LactationStage,
    nextBasis: LactationBasis
  ) {
    setStatus(nextStatus);
    setStage(nextStage);
    setBasis(nextBasis);
    startTransition(async () => {
      await setLactation(
        nextStatus,
        nextStatus === "none" ? null : nextStage,
        nextBasis
      );
    });
  }

  const nursing = status !== "none";
  const extra = lactationKcal({
    lactationStatus: status,
    lactationStage: stage,
    lactationBasis: basis,
  });

  return (
    <div className="space-y-3">
      <Card className="space-y-2 rounded-2xl border-border/60 p-3 shadow-card">
        <div className="flex items-center gap-1.5 px-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <Baby className="h-3 w-3 text-fuchsia-500/80" />
          Breastfeeding
        </div>
        <div className="grid grid-cols-3 gap-1">
          {STATUS_OPTIONS.map((opt) => {
            const active = opt.value === status;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => save(opt.value, stage, basis)}
                className={cn(
                  "rounded-xl px-2 py-2.5 text-center text-[11px] font-medium transition-all",
                  active
                    ? "bg-foreground text-background"
                    : "text-foreground/70 hover:bg-accent/40 hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="px-1 pt-1 text-[11px] text-muted-foreground/80">
          {STATUS_OPTIONS.find((o) => o.value === status)?.hint}
        </p>
      </Card>

      {nursing && (
        <>
          <Card className="space-y-2 rounded-2xl border-border/60 p-3 shadow-card">
            <div className="px-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Baby&rsquo;s age
            </div>
            <div className="grid grid-cols-3 gap-1">
              {LACTATION_STAGES.map((s) => {
                const active = s === stage;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => save(status, s, basis)}
                    className={cn(
                      "rounded-xl px-2 py-2.5 text-center text-[11px] font-medium transition-all",
                      active
                        ? "bg-foreground text-background"
                        : "text-foreground/70 hover:bg-accent/40 hover:text-foreground"
                    )}
                  >
                    {lactationStageLabel(s)}
                  </button>
                );
              })}
            </div>
            <p className="px-1 pt-1 text-[11px] text-muted-foreground/80">
              Milk production tapers as your baby grows and starts solids.
            </p>
          </Card>

          <Card className="space-y-1.5 rounded-2xl border-border/60 p-3 shadow-card">
            <div className="px-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              What&rsquo;s your aim?
            </div>
            {BASIS_OPTIONS.map((opt) => {
              const active = opt.value === basis;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => save(status, stage, opt.value)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-left transition-all",
                    active
                      ? "bg-foreground text-background"
                      : "text-foreground/80 hover:bg-accent/40 hover:text-foreground"
                  )}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div
                    className={cn(
                      "text-[11px]",
                      active ? "text-background/70" : "text-muted-foreground"
                    )}
                  >
                    {opt.hint}
                  </div>
                </button>
              );
            })}
          </Card>

          <Card className="rounded-2xl border-border/60 p-4 shadow-card">
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Added to maintenance
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">
                +{extra.toLocaleString()}
              </span>
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                kcal / day
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground/80">
              The energy your body spends making milk, added on top of your BMR
              + activity.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
