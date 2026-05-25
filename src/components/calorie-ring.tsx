type Props = {
  consumed: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
};

export function CalorieRing({
  consumed,
  goal,
  size = 240,
  strokeWidth = 14,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(consumed / goal, 1);
  const dash = circumference * pct;
  const remaining = Math.max(goal - consumed, 0);

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
        className="-rotate-90 drop-shadow-[0_8px_24px_oklch(0.7_0.18_40_/_0.18)]"
      >
        <defs>
          <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.85 0.16 80)" />
            <stop offset="100%" stopColor="oklch(0.65 0.22 25)" />
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
          stroke="url(#calorieGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-6xl font-semibold leading-none tracking-tight tabular-nums">
          {consumed.toLocaleString()}
        </div>
        <div className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          of {goal.toLocaleString()} kcal
        </div>
        <div className="mt-4 text-xs font-medium text-muted-foreground tabular-nums">
          {remaining > 0
            ? `${remaining.toLocaleString()} left today`
            : `${(consumed - goal).toLocaleString()} over goal`}
        </div>
      </div>
    </div>
  );
}
