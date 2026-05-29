import { AppLink } from "@/components/app-link";
import { MacroCard } from "@/components/macro-card";
import { WidgetMenu } from "@/components/widget-menu";
import type { MacroGoals } from "@/lib/macros";

// Match the dots inside MacroCard.
const ACCENTS = {
  protein: "oklch(0.68 0.2 20)",
  carbs: "oklch(0.78 0.16 75)",
  fat: "oklch(0.6 0.18 280)",
} as const;

type Totals = { protein: number; carbs: number; fat: number };

export function MacrosWidget({
  consumed,
  goals,
}: {
  consumed: Totals;
  goals: MacroGoals;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <AppLink
          href="/calories"
          aria-label="View macros history"
          className="group inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-foreground">
            Macros
          </h2>
        </AppLink>
        <WidgetMenu widgetId="macros" label="Macros" size="sm" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <MacroCard
          label="Protein"
          value={Math.round(consumed.protein)}
          goal={goals.protein}
          accent={ACCENTS.protein}
        />
        <MacroCard
          label="Carbs"
          value={Math.round(consumed.carbs)}
          goal={goals.carbs}
          accent={ACCENTS.carbs}
        />
        <MacroCard
          label="Fat"
          value={Math.round(consumed.fat)}
          goal={goals.fat}
          accent={ACCENTS.fat}
        />
      </div>
    </section>
  );
}
