// The small pieces of the macro language: the P / C / F figures, the stripe
// showing what a meal's calories were made of, and the note that explains the
// grey slice. Colour means the same thing here as in the ring and the hero's
// macro columns.

import { macroShares } from "@/lib/macros";
import { macroParts, metricColor } from "@/lib/metric-colors";
import type { MacroGrams, Nutrients } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export function MacroFigures({
  proteinG,
  carbsG,
  fatG,
  strong = false,
  className,
}: MacroGrams & {
  /** The meal's totals, as opposed to one food's quieter line beneath it. */
  strong?: boolean;
  className?: string;
}) {
  const figures = [
    { letter: "P", grams: proteinG, color: metricColor.protein },
    { letter: "C", grams: carbsG, color: metricColor.carbs },
    { letter: "F", grams: fatG, color: metricColor.fat },
  ];
  return (
    <span className={cn("flex gap-2 tabular-nums", className)}>
      {figures.map(({ letter, grams, color }) => (
        <span key={letter}>
          <span className="font-medium" style={{ color }}>
            {letter}
          </span>{" "}
          <span className={strong ? "font-medium text-foreground" : undefined}>
            {Math.round(grams)}
          </span>
        </span>
      ))}
    </span>
  );
}

// Decorative in the assistive-tech sense: the same numbers are printed as text.
export function MacroStripe({
  kcal,
  proteinG,
  carbsG,
  fatG,
  className,
}: Nutrients & { className?: string }) {
  const shares = macroShares({ kcal, proteinG, carbsG, fatG });
  if (!shares) return null;
  return (
    <div aria-hidden className={cn("flex h-1 gap-0.5", className)}>
      {macroParts
        .filter(({ key }) => shares[key] > 0)
        .map(({ key, color }) => (
          <span
            key={key}
            className="min-w-1 rounded-full"
            style={{ flexGrow: shares[key], backgroundColor: color }}
          />
        ))}
    </div>
  );
}

// Names the grey slice so it doesn't read as a glitch, and so a food logged
// without macros is noticeable rather than silently undercounted.
export function MacroGapNote({
  kcal,
  proteinG,
  carbsG,
  fatG,
  className,
}: Nutrients & { className?: string }) {
  const shares = macroShares({ kcal, proteinG, carbsG, fatG });
  const unknownKcal = Math.round((shares?.unknown ?? 0) * kcal);
  if (unknownKcal <= 0) return null;
  return (
    <p
      className={cn(
        "flex items-center justify-center gap-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: metricColor.unknownMacro }}
      />
      {unknownKcal.toLocaleString()} kcal logged without macros
    </p>
  );
}
