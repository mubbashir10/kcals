import { macroShares } from "@/lib/macros";
import { macroParts } from "@/lib/metric-colors";
import type { MacroGrams } from "@/lib/nutrition";
import { cn, percentOfGoal } from "@/lib/utils";

export type CalorieDisplayMode = "remaining" | "consumed";

type Props = {
  consumed: number;
  goal: number;
  mode: CalorieDisplayMode;
  /** What the day's calories were made of. */
  macros: MacroGrams;
};

const SIZE = 240;
const STROKE = 16;

// 270° open gauge: the arc spans three-quarters of the circle with the gap
// centered at the bottom. Rotating the stroke by 135° puts the dash start at
// the bottom-left (7:30) so the visible arc sweeps clockwise over the top and
// down to the bottom-right (4:30).
const ARC_FRACTION = 0.75;
const START_DEG = 135;

// Daylight between two neighbouring segments, on top of their round caps.
const SEGMENT_GAP = 3;

// However small the overage, it has to be visible as more than a hairline.
const MIN_OVER_SHARE = 0.03;

export function CalorieRing({ consumed, goal, mode, macros }: Props) {
  const center = SIZE / 2;
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const track = ARC_FRACTION * circumference;

  const over = consumed > goal;

  // The arc is the day's food, in the macro colours, filling up towards the
  // goal. It doesn't change with the display mode; that only picks which number
  // sits in the middle.
  const filled = (percentOfGoal(consumed, goal) / 100) * track;
  const overShare = over
    ? Math.max((consumed - goal) / consumed, MIN_OVER_SHARE)
    : 0;
  const shares = macroShares({ kcal: consumed, ...macros });
  const eatenShare = 1 - overShare;
  const parts = [
    ...macroParts.map(({ key, color }) => ({
      color,
      share: (shares?.[key] ?? 0) * eatenShare,
    })),
    { color: "var(--destructive)", share: overShare },
  ].filter((p) => p.share > 0);

  // In remaining mode a goal you've passed reads as the overage; in consumed
  // mode the number is still simply what you ate.
  const showOverage = over && mode === "remaining";
  const primary = mode === "consumed" ? consumed : Math.abs(goal - consumed);
  const label =
    mode === "consumed"
      ? "kcal consumed"
      : showOverage
        ? "kcal over goal"
        : "kcal remaining";

  return (
    <div
      className="relative shrink-0"
      style={{ width: SIZE, height: SIZE }}
      aria-label={`${consumed} of ${goal} calories consumed`}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <g transform={`rotate(${START_DEG} ${center} ${center})`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${track} ${circumference}`}
          />
          {segments(parts, filled).map((s, i) => (
            <circle
              key={s.color}
              className="ring-segment"
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${s.length} ${circumference}`}
              strokeDashoffset={-s.start}
              // color-mix() and var() only resolve through style, not the SVG
              // presentation attribute.
              style={
                {
                  stroke: s.color,
                  animationDelay: `${i * 90}ms`,
                  "--ring-circumference": circumference,
                } as React.CSSProperties
              }
            />
          ))}
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <div
          className={cn(
            "font-heading text-[3.5rem] font-semibold leading-none tracking-tight tabular-nums",
            showOverage && "text-destructive"
          )}
        >
          {primary.toLocaleString()}
        </div>
        <div className="mt-2 text-[13px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

// Lay the parts end to end along the filled length. Each one's round caps reach
// STROKE/2 past its ends, so an inner edge is pulled back by that plus half the
// gap; the outer two stay put so the fill's ends sit where the track's do.
function segments(
  parts: { color: string; share: number }[],
  filled: number
): { color: string; start: number; length: number }[] {
  const inset = STROKE / 2 + SEGMENT_GAP / 2;
  let cursor = 0;
  return parts.map((part, i) => {
    const span = part.share * filled;
    const start = cursor + (i > 0 ? inset : 0);
    const end = cursor + span - (i < parts.length - 1 ? inset : 0);
    cursor += span;
    // A slice narrower than its caps collapses to a dot rather than vanishing.
    return { color: part.color, start, length: Math.max(end - start, 0.01) };
  });
}
