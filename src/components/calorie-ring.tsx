export type CalorieDisplayMode = "remaining" | "consumed";

type Props = {
  consumed: number;
  goal: number;
  mode?: CalorieDisplayMode;
  size?: number;
  strokeWidth?: number;
};

export function CalorieRing({
  consumed,
  goal,
  mode = "remaining",
  size = 240,
  strokeWidth = 14,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const remainingRaw = goal - consumed;
  const overGoal = remainingRaw < 0;
  const remaining = Math.max(remainingRaw, 0);

  // Consumed mode: arc fills as you eat (empty → full).
  // Remaining mode: arc drains as you eat (full → empty) so you can see at
  // a glance how much room you've got left.
  // When over goal: in either mode show the ring fully lit in the over-goal
  // color, so it reads as "stop eating" regardless of which label is active.
  const consumedPct = Math.min(consumed / goal, 1);
  const remainingPct = Math.max(remaining / goal, 0);
  const pct = overGoal ? 1 : mode === "remaining" ? remainingPct : consumedPct;
  const dash = circumference * pct;

  // What occupies the big number, and the smaller secondary line.
  const primary =
    mode === "remaining"
      ? overGoal
        ? consumed - goal
        : remaining
      : consumed;

  const primaryHint =
    mode === "remaining"
      ? overGoal
        ? "over goal"
        : "left today"
      : `of ${goal.toLocaleString()} kcal`;

  const secondaryLine =
    mode === "remaining"
      ? `${consumed.toLocaleString()} consumed`
      : overGoal
        ? `${(consumed - goal).toLocaleString()} over goal`
        : `${remaining.toLocaleString()} left today`;

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
      className="relative"
      style={{ width: size, height: size }}
      aria-label={`${consumed} of ${goal} calories consumed`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
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

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{
            transition:
              "stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1), stroke 400ms ease-out",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl font-semibold leading-none tracking-tight tabular-nums">
          {primary.toLocaleString()}
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {primaryHint}
        </div>
        <div className="mt-3 truncate text-[11px] font-medium text-muted-foreground tabular-nums">
          {secondaryLine}
        </div>
      </div>
    </div>
  );
}
