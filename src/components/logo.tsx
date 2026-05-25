import { cn } from "@/lib/utils";

// kcals mark — a lowercase "k" whose ascender curls into a flame tip,
// rendered on a rounded gradient tile. Designed for the header but works
// anywhere a square brand mark is needed (favicon, og-image, etc.).
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-sm",
        "ring-1 ring-inset ring-white/15",
        className
      )}
    >
      {/* soft inner highlight to give the tile some life */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_30%_0%,rgba(255,255,255,0.35)_0%,transparent_55%)]"
      />
      <LogoGlyph className="relative h-[58%] w-[58%]" />
    </span>
  );
}

// Just the white glyph — no tile. Useful when the gradient lives elsewhere
// (e.g. layered over a custom background) or when exporting a monochrome mark.
export function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      {/* The k. Drawn as a single filled path so the flame tip and stem read
          as one continuous shape — the ascender lifts off the stem and curls
          into a teardrop flame, while the right-side arm + leg form the k's
          diagonal. */}
      <path
        d="
          M 8.6 22
          L 8.6 11.2
          C 8.6 9.6 9.2 8.2 10.1 6.9
          C 10.9 5.7 11.4 4.6 11.2 3.2
          C 12.3 4.1 12.9 5.4 12.8 6.8
          C 13.5 6.0 13.9 5.1 13.9 4.2
          C 14.7 5.7 14.6 7.5 13.6 9.0
          C 12.9 10.1 12.0 10.9 11.0 11.6
          L 11.0 14.6
          L 14.6 11.4
          L 17.4 11.4
          L 13.1 15.2
          L 17.8 22
          L 14.7 22
          L 11.0 16.6
          L 11.0 22
          Z
        "
        fill="currentColor"
      />
    </svg>
  );
}
