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

  // Color identity per mode. Brand-green for "room to eat", warm amber→red
  // for "energy spent", deep red overflow for either when past goal.
  const gradientId = overGoal
    ? "calorieRing-over"
    : mode === "remaining"
      ? "calorieRing-remaining"
      : "calorieRing-consumed";

  const glow = overGoal
    ? "drop-shadow-[0_8px_24px_oklch(0.6_0.24_25_/_0.28)]"
    : mode === "remaining"
      ? "drop-shadow-[0_8px_24px_oklch(0.7_0.18_145_/_0.22)]"
      : "drop-shadow-[0_8px_24px_oklch(0.7_0.18_40_/_0.20)]";

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
        className={`-rotate-90 ${glow}`}
      >
        <defs>
          {/* Remaining: lime → emerald (matches the kcals brand mark) */}
          <linearGradient
            id="calorieRing-remaining"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="oklch(0.86 0.18 145)" />
            <stop offset="100%" stopColor="oklch(0.62 0.18 155)" />
          </linearGradient>

          {/* Consumed: amber → red (warm "spent energy") */}
          <linearGradient
            id="calorieRing-consumed"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="oklch(0.85 0.16 80)" />
            <stop offset="100%" stopColor="oklch(0.65 0.22 25)" />
          </linearGradient>

          {/* Over-goal: deep crimson, full ring */}
          <linearGradient
            id="calorieRing-over"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="oklch(0.7 0.22 30)" />
            <stop offset="100%" stopColor="oklch(0.55 0.24 22)" />
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
        <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {primaryHint}
        </div>
        <div className="mt-3 truncate text-[11px] font-medium text-muted-foreground tabular-nums">
          {secondaryLine}
        </div>
      </div>
    </div>
  );
}
