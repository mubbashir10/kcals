// Per-metric accent colors, sourced from theme CSS vars so a theme swap
// re-colors the whole dashboard cohesively — nothing hardcoded. The chart-*
// tokens are the theme's curated data-viz palette (distinct hues), with
// primary reserved for energy/calories and destructive for over-goal warnings.
export const metricColor = {
  energy: "var(--primary)", // calories / maintenance — brand
  activity: "var(--chart-2)", // movement
  weight: "var(--chart-4)", // body weight
  calendar: "var(--chart-5)", // streak / calendar
  protein: "var(--protein)",
  carbs: "var(--carbs)",
  fat: "var(--fat)",
  // Calories we have no macros for, e.g. a food logged without them.
  unknownMacro: "color-mix(in oklch, var(--muted-foreground) 45%, transparent)",
} as const;

// The slices calories divide into, in the order the ring and stripes draw them.
export const macroParts = [
  { key: "protein", color: metricColor.protein },
  { key: "carbs", color: metricColor.carbs },
  { key: "fat", color: metricColor.fat },
  { key: "unknown", color: metricColor.unknownMacro },
] as const;
