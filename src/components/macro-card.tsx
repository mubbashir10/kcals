import { Card } from "@/components/ui/card";

type Props = {
  label: string;
  value: number;
  goal: number;
  unit?: string;
  accent: string;
};

export function MacroCard({ label, value, goal, unit = "g", accent }: Props) {
  const pct = Math.min((value / goal) * 100, 100);
  return (
    <Card className="gap-0 rounded-2xl border-border/60 p-5 shadow-none transition-colors hover:bg-accent/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground/80">
          {value}/{goal}
          {unit}
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold leading-none tabular-nums tracking-tight">
        {value}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          {unit}
        </span>
      </div>
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: accent }}
        />
      </div>
    </Card>
  );
}
