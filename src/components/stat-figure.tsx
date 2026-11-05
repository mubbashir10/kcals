import { cn } from "@/lib/utils";

const SIZES = {
  xl: { value: "text-xl", unit: "text-xs" },
  "2xl": { value: "text-2xl", unit: "text-sm" },
  "3xl": { value: "text-3xl", unit: "text-sm" },
  "4xl": { value: "text-4xl", unit: "text-sm" },
  "5xl": { value: "text-5xl", unit: "text-base" },
} as const;

// A headline number with its unit beside it. They're siblings so the unit stays
// in the body face rather than inheriting the display one.
export function StatFigure({
  value,
  unit,
  size,
  className,
}: {
  value: React.ReactNode;
  unit?: string;
  size: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-1.5", className)}>
      <span
        className={cn(
          "font-heading font-semibold leading-none tabular-nums tracking-tight",
          SIZES[size].value
        )}
      >
        {value}
      </span>
      {unit && (
        <span className={cn("text-muted-foreground", SIZES[size].unit)}>
          {unit}
        </span>
      )}
    </div>
  );
}
