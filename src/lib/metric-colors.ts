// Per-metric accent colors, sourced from theme CSS vars so a theme swap
// re-colors the whole dashboard cohesively — nothing hardcoded. The chart-*
// tokens are the theme's curated data-viz palette (distinct hues), with
// primary reserved for energy/calories and destructive for over-goal warnings.
export const metricColor = {
  energy: "var(--primary)", // calories / maintenance — brand
  activity: "var(--chart-2)", // movement
  weight: "var(--chart-4)", // body weight
  calendar: "var(--chart-5)", // streak / calendar
  protein: "var(--chart-2)",
  carbs: "var(--chart-5)",
  fat: "var(--chart-4)",
} as const;

// A translucent tint of a metric color, for icon-chip / pill backgrounds.
export function metricTint(color: string, pct = 16): string {
  return `color-mix(in oklch, ${color} ${pct}%, transparent)`;
}
