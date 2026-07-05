// kcals brand mark — the flame SVG path, shared by every next/og image route
// (icon, apple-icon, opengraph, maskable icon, promo screenshots) so the mark
// has a single source of truth. Note: components/logo.tsx can't be reused in
// these routes — it renders an <img> to /logo.svg, which Satori (next/og)
// can't load; the path has to be inlined as SVG.
export const FLAME_PATH =
  "M13.5 2.7c.22 2.93 1.78 5.13 3.4 7.36 1.7 2.34 3.2 4.55 3.2 7.59 0 4.55-3.42 7.94-7.62 7.94S4.86 22.2 4.86 17.65c0-1.98.79-3.62 1.95-4.91.46.81 1.13 1.4 2.07 1.63-.55-1.87-.32-3.97.84-5.72 1.04-1.55 2.74-2.57 3.01-4.32.66.47 1.13 1.05 1.4 1.75.12-1.16.04-2.32-.63-3.38z";
