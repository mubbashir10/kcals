"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCustomFood } from "@/app/actions/custom-foods";

export function CustomFoodDialog({
  open,
  onOpenChange,
  initialName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogTitle className="text-base font-semibold">
          Save a custom food
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Visible to everyone — share food that USDA doesn&apos;t have.
        </DialogDescription>

        {/* key forces a remount each time the dialog opens, so all the
            local field state resets cleanly without an effect. */}
        <CustomFoodForm
          key={open ? `open:${initialName ?? ""}` : "closed"}
          initialName={initialName}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CustomFoodForm({
  initialName,
  onSaved,
}: {
  initialName?: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [brand, setBrand] = useState("");
  // Most labels are per-serving; we convert to per-100g on save.
  const [mode, setMode] = useState<"per100" | "perServing">("perServing");
  const [servingG, setServingG] = useState("");
  const [servingLabel, setServingLabel] = useState("");

  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  // Optional, collapsed by default
  const [moreOpen, setMoreOpen] = useState(false);
  const [fiber, setFiber] = useState("");
  const [sugar, setSugar] = useState("");
  const [satFat, setSatFat] = useState("");
  const [sodium, setSodium] = useState("");
  const [cholesterol, setCholesterol] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSave() {
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give your food a name.");
      return;
    }

    const k = parseFloat(kcal);
    if (!Number.isFinite(k) || k <= 0) {
      setError("Calories is required.");
      return;
    }

    let scale = 1;
    let savedServingG: number | null = null;
    if (mode === "perServing") {
      const grams = parseFloat(servingG);
      if (!Number.isFinite(grams) || grams <= 0) {
        setError("Serving size in grams is required when entering per-serving values.");
        return;
      }
      scale = 100 / grams;
      savedServingG = grams;
    }

    const per100 = {
      kcal: k * scale,
      proteinG: scaledOrNull(protein, scale),
      carbsG: scaledOrNull(carbs, scale),
      fatG: scaledOrNull(fat, scale),
      fiberG: scaledOrNull(fiber, scale),
      sugarG: scaledOrNull(sugar, scale),
      saturatedFatG: scaledOrNull(satFat, scale),
      sodiumMg: scaledOrNull(sodium, scale),
      cholesterolMg: scaledOrNull(cholesterol, scale),
    };

    if (per100.kcal > 900) {
      setError("That works out to > 900 kcal/100g — double-check the serving size.");
      return;
    }

    startTransition(async () => {
      try {
        await createCustomFood({
          name: trimmedName,
          brand: brand.trim() || null,
          ...per100,
          servingSizeG: savedServingG,
          servingLabel: servingLabel.trim() || null,
        });
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Identity */}
      <Row>
        <Field id="cf-name" label="Name" required>
          <Input
            id="cf-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mom's lasagna"
          />
        </Field>
      </Row>

      <Row>
        <Field id="cf-brand" label="Brand" optional>
          <Input
            id="cf-brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Dawn Foods"
          />
        </Field>
      </Row>

      {/* Mode toggle */}
      <div className="space-y-2">
        <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Values are
        </Label>
        <div className="inline-flex w-full rounded-full bg-muted p-1">
          {(
            [
              { v: "perServing", label: "Per serving" },
              { v: "per100", label: "Per 100g" },
            ] as const
          ).map((opt) => {
            const active = mode === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => setMode(opt.v)}
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

      {mode === "perServing" && (
        <div className="grid grid-cols-2 gap-3">
          <NutrientField
            id="cf-serving-g"
            label="Serving size"
            suffix="g"
            value={servingG}
            onChange={setServingG}
            placeholder="100"
          />
          <Field id="cf-serving-label" label="Label" optional>
            <Input
              id="cf-serving-label"
              value={servingLabel}
              onChange={(e) => setServingLabel(e.target.value)}
              placeholder="1 slice"
            />
          </Field>
        </div>
      )}

      {/* Macros */}
      <div className="grid grid-cols-2 gap-3">
        <NutrientField
          id="cf-kcal"
          label="Calories"
          suffix="kcal"
          value={kcal}
          onChange={setKcal}
          placeholder="250"
          required
        />
        <NutrientField
          id="cf-protein"
          label="Protein"
          suffix="g"
          value={protein}
          onChange={setProtein}
          placeholder="20"
        />
        <NutrientField
          id="cf-carbs"
          label="Carbs"
          suffix="g"
          value={carbs}
          onChange={setCarbs}
          placeholder="30"
        />
        <NutrientField
          id="cf-fat"
          label="Fat"
          suffix="g"
          value={fat}
          onChange={setFat}
          placeholder="8"
        />
      </div>

      {/* Optional details */}
      <button
        type="button"
        onClick={() => setMoreOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>More nutrients (optional)</span>
        {moreOpen ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {moreOpen && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <NutrientField
            id="cf-fiber"
            label="Fiber"
            suffix="g"
            value={fiber}
            onChange={setFiber}
          />
          <NutrientField
            id="cf-sugar"
            label="Sugar"
            suffix="g"
            value={sugar}
            onChange={setSugar}
          />
          <NutrientField
            id="cf-satfat"
            label="Sat. fat"
            suffix="g"
            value={satFat}
            onChange={setSatFat}
          />
          <NutrientField
            id="cf-sodium"
            label="Sodium"
            suffix="mg"
            value={sodium}
            onChange={setSodium}
          />
          <NutrientField
            id="cf-cholesterol"
            label="Cholesterol"
            suffix="mg"
            value={cholesterol}
            onChange={setCholesterol}
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-2">
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
          {pending ? "Saving…" : "Save food"}
        </Button>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function Field({
  id,
  label,
  optional,
  required,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label
          htmlFor={id}
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
        >
          {label}
        </Label>
        {optional && (
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
            Optional
          </span>
        )}
        {required && (
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
            Required
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function NutrientField({
  id,
  label,
  suffix,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Field id={id} label={label} required={required}>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-12"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {suffix}
        </span>
      </div>
    </Field>
  );
}

function scaledOrNull(s: string, scale: number): number | null {
  if (s.trim() === "") return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n * scale;
}
