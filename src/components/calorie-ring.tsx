import { Flame, Utensils } from "lucide-react";

export type CalorieDisplayMode = "remaining" | "consumed";

type Props = {
  consumed: number;
  goal: number;
  mode?: CalorieDisplayMode;
  size?: number;
  strokeWidth?: number;
};

// 270° open gauge: the arc spans three-quarters of the circle with the gap
// centered at the bottom. Rotating the stroke by 135° puts the dash start at
// the bottom-left (7:30) so the visible arc sweeps clockwise over the top and
// down to the bottom-right (4:30).
const ARC_FRACTION = 0.75;
const START_DEG = 135;
const SWEEP_DEG = 270;

export function CalorieRing({
  consumed,
  goal,
  mode = "remaining",
  size = 240,
  strokeWidth = 14,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const trackDash = ARC_FRACTION * circumference;

  const remainingRaw = goal - consumed;
  const overGoal = remainingRaw < 0;
  const remaining = Math.max(remainingRaw, 0);

  // Consumed mode: arc fills as you eat (empty → full).
  // Remaining mode: arc drains as you eat (full → empty) so you can see at
  // a glance how much room you've got left.
  // When over goal: in either mode show the arc fully lit in the over-goal
  // color, so it reads as "stop eating" regardless of which label is active.
  const consumedPct = Math.min(consumed / goal, 1);
  const remainingPct = Math.max(remaining / goal, 0);
  const pct = overGoal ? 1 : mode === "remaining" ? remainingPct : consumedPct;

  // Knob position: the tip of the progress arc, in the SVG's screen-space
  // (clockwise from +x, y-down) — the same convention the 135° rotation uses.
  const knobDeg = START_DEG + SWEEP_DEG * pct;
  const knobRad = (knobDeg * Math.PI) / 180;
  const knobX = cx + radius * Math.cos(knobRad);
  const knobY = cy + radius * Math.sin(knobRad);

  // The big number and its label.
  const primary =
    mode === "remaining"
      ? overGoal
        ? consumed - goal
        : remaining
      : consumed;

  const topLabel = overGoal
    ? "Over goal"
    : mode === "remaining"
      ? "Remaining"
      : "Consumed";

  // Consumed shows what you ate (fork/knife); remaining/over reads as energy.
  const CenterIcon = mode === "consumed" && !overGoal ? Utensils : Flame;

  // Ring color is theme-driven — each mode gets its own hue from the theme
  // palette, no hardcoded colors: primary (brand green) for "room left today",
  // the cool chart-2 tone for "energy consumed", and the destructive token
  // when past goal so it reads as "stop eating" whichever label is active.
  const ringColor = overGoal
    ? "var(--destructive)"
    : mode === "remaining"
      ? "var(--primary)"
      : "var(--chart-2)";

  const gradientId = overGoal
    ? "calorieRing-over"
    : mode === "remaining"
      ? "calorieRing-remaining"
      : "calorieRing-consumed";

  const glowColor = `color-mix(in oklch, ${ringColor} ${overGoal ? "26%" : "22%"}, transparent)`;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={`${consumed} of ${goal} calories consumed`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ filter: `drop-shadow(0 8px 24px ${glowColor})` }}
      >
        <defs>
          {/* Each ring hue is a theme CSS var (so it tracks the active theme +
              light/dark). `var()` must be applied via `style`, not the SVG
              attribute, to resolve. The second stop is a slightly deepened
              shade of the same token for a subtle sheen. */}
          <linearGradient
            id="calorieRing-remaining"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" style={{ stopColor: "var(--primary)" }} />
            <stop
              offset="100%"
              style={{ stopColor: "color-mix(in oklch, var(--primary), black 22%)" }}
            />
          </linearGradient>

          <linearGradient
            id="calorieRing-consumed"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" style={{ stopColor: "var(--chart-2)" }} />
            <stop
              offset="100%"
              style={{ stopColor: "color-mix(in oklch, var(--chart-2), black 18%)" }}
            />
          </linearGradient>

          <linearGradient
            id="calorieRing-over"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" style={{ stopColor: "var(--destructive)" }} />
            <stop
              offset="100%"
              style={{ stopColor: "color-mix(in oklch, var(--destructive), black 18%)" }}
            />
          </linearGradient>
        </defs>

        <g transform={`rotate(${START_DEG} ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${trackDash} ${circumference}`}
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${pct * trackDash} ${circumference}`}
            style={{
              transition:
                "stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1), stroke 400ms ease-out",
            }}
          />
        </g>

        {pct > 0 && (
          <circle
            cx={knobX}
            cy={knobY}
            r={strokeWidth * 0.72}
            stroke="var(--background)"
            strokeWidth={3}
            style={{
              fill: ringColor,
              transition:
                "cx 900ms cubic-bezier(0.22, 1, 0.36, 1), cy 900ms cubic-bezier(0.22, 1, 0.36, 1), fill 400ms ease-out",
            }}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <CenterIcon
          className="mb-1.5 h-5 w-5"
          style={{ color: ringColor }}
          strokeWidth={2}
          aria-hidden
        />
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {topLabel}
        </div>
        <div className="mt-1 text-5xl font-semibold leading-none tracking-tight tabular-nums">
          {primary.toLocaleString()}
        </div>
        <div className="mt-1.5 text-[11px] font-medium text-muted-foreground">
          kcal
        </div>
      </div>
    </div>
  );
}
