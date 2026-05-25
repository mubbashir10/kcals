"use client";

import { useState, useTransition } from "react";
import { Infinity as InfinityIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setMacroGoal } from "@/app/actions/widgets";
import {
  defaultAutoGrams,
  MACROS,
  type Macro,
  type MacroMode,
} from "@/lib/macros";
import { cn } from "@/lib/utils";

type PerMacro = { mode: MacroMode; g: number | null };

type Props = {
  initial: Record<Macro, PerMacro>;
  /** Effective calorie goal — used to seed Custom defaults. */
  calorieGoal: number;
};

const META: Record<Macro, { label: string; accent: string }> = {
  protein: { label: "Protein", accent: "oklch(0.68 0.2 20)" },
  carbs: { label: "Carbs", accent: "oklch(0.78 0.16 75)" },
  fat: { label: "Fat", accent: "oklch(0.6 0.18 280)" },
};

export function MacrosSettings({ initial, calorieGoal }: Props) {
  return (
    <Card className="space-y-3 rounded-2xl border-border/60 p-3 shadow-card">
      {MACROS.map((m) => (
        <MacroRow
          key={m}
          macro={m}
          calorieGoal={calorieGoal}
          initial={initial[m]}
        />
      ))}
    </Card>
  );
}

function MacroRow({
  macro,
  calorieGoal,
  initial,
}: {
  macro: Macro;
  calorieGoal: number;
  initial: PerMacro;
}) {
  const auto = defaultAutoGrams(macro, calorieGoal);
  const [mode, setMode] = useState<MacroMode>(initial.mode);
  const [customStr, setCustomStr] = useState<string>(
    initial.g != null ? String(initial.g) : String(auto)
  );
  const [, startTransition] = useTransition();

  function persist(nextMode: MacroMode, nextG: number | null) {
    startTransition(async () => {
      await setMacroGoal(macro, nextMode, nextG);
    });
  }

  function onModeClick(next: MacroMode) {
    if (next === mode) return;
    setMode(next);
    if (next === "custom") {
      const n = parseInt(customStr, 10);
      const g = Number.isFinite(n) && n >= 0 ? n : auto;
      if (!Number.isFinite(parseInt(customStr, 10))) {
        setCustomStr(String(auto));
      }
      persist("custom", g);
    } else {
      persist(next, null);
    }
  }

  function onCustomChange(s: string) {
    setCustomStr(s);
    const n = parseInt(s, 10);
    if (Number.isFinite(n) && n >= 0 && n < 2000) {
      persist("custom", n);
    }
  }

  const meta = META[macro];

  return (
    <div className="space-y-2 rounded-xl px-1 py-1">
      <div className="flex items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: meta.accent }}
            aria-hidden
          />
          <span className="text-sm font-medium">{meta.label}</span>
        </div>
        <ModeToggle mode={mode} onChange={onModeClick} />
      </div>

      {mode === "auto" && (
        <p className="px-2 text-[11px] text-muted-foreground">
          Auto from calorie target · ~{auto} g/day
        </p>
      )}
      {mode === "custom" && (
        <div className="relative px-2">
          <Input
            inputMode="numeric"
            value={customStr}
            onChange={(e) => onCustomChange(e.target.value)}
            className="h-9 pr-9 text-sm tabular-nums"
          />
          <span className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-xs text-muted-foreground">
            g
          </span>
        </div>
      )}
      {mode === "off" && (
        <p className="flex items-center gap-1 px-2 text-[11px] text-muted-foreground">
          <InfinityIcon className="h-3 w-3" />
          Not tracked
        </p>
      )}
    </div>
  );
}

const MODES: { value: MacroMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "custom", label: "Custom" },
  { value: "off", label: "Off" },
];

function ModeToggle({
  mode,
  onChange,
}: {
  mode: MacroMode;
  onChange: (next: MacroMode) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-muted/60 p-0.5">
      {MODES.map((m) => {
        const active = m.value === mode;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
