import { ArrowLeft, ChevronRight, Utensils } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { MealCard } from "@/components/meal-card";
import { db } from "@/lib/db";
import { dayKeyInTz, parseDayKey, startOfDayInTz } from "@/lib/clock";
import { requireProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

// How far back to fetch. 180 days covers ~6 months of meals — enough to feel
// like real history without dragging on the initial render. We'll add paging
// only if it becomes a real problem.
const DAYS = 180;

export default async function DiaryPage() {
  const { userId, profile } = await requireProfile();
  const tz = profile.timezone || "UTC";
  const since = new Date(new Date().getTime() - DAYS * 86400_000);

  const meals = await db.meal.findMany({
    where: { userId, loggedAt: { gte: since } },
    orderBy: { loggedAt: "desc" },
    include: { foods: { orderBy: { loggedAt: "asc" } } },
  });

  // Group meals by the user-tz day they were logged in.
  type DayGroup = {
    dayKey: string;
    meals: typeof meals;
    kcal: number;
    foodCount: number;
  };
  const byDay = new Map<string, DayGroup>();
  for (const meal of meals) {
    const key = dayKeyInTz(tz, meal.loggedAt);
    const existing =
      byDay.get(key) ?? { dayKey: key, meals: [], kcal: 0, foodCount: 0 };
    existing.meals.push(meal);
    existing.kcal += meal.foods.reduce((acc, f) => acc + f.kcal, 0);
    existing.foodCount += meal.foods.length;
    byDay.set(key, existing);
  }

  const dayGroups = Array.from(byDay.values()).sort((a, b) =>
    b.dayKey.localeCompare(a.dayKey)
  );

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-6">
          <AppLink
            href="/"
            direction="back"
            aria-label="Back"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </AppLink>
          <span className="text-sm font-semibold tracking-tight">
            Food diary
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {dayGroups.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-16 text-center shadow-none">
            <Utensils className="mx-auto h-6 w-6 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No meals logged in the last {DAYS} days.
            </p>
          </Card>
        ) : (
          <div className="space-y-10">
            {dayGroups.map((group) => (
              <DaySection key={group.dayKey} group={group} timezone={tz} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function DaySection({
  group,
  timezone,
}: {
  group: {
    dayKey: string;
    meals: {
      id: number;
      name: string | null;
      loggedAt: Date;
      foods: {
        id: number;
        name: string;
        brand: string | null;
        grams: number;
        kcal: number;
        proteinG: number;
        carbsG: number;
        fatG: number;
      }[];
    }[];
    kcal: number;
    foodCount: number;
  };
  timezone: string;
}) {
  const dateLabel = formatDayHeading(group.dayKey, timezone);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between px-1">
        <AppLink
          href={`/day/${group.dayKey}`}
          aria-label={`Open ${dateLabel}`}
          className="group inline-flex items-baseline gap-1.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <h2 className="text-sm font-semibold tracking-tight transition-colors group-hover:text-foreground">
            {dateLabel}
          </h2>
          <ChevronRight className="h-3 w-3 self-center text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
        </AppLink>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground/80">
            {Math.round(group.kcal).toLocaleString()}
          </span>{" "}
          kcal · {group.meals.length}{" "}
          {group.meals.length === 1 ? "meal" : "meals"} · {group.foodCount}{" "}
          {group.foodCount === 1 ? "food" : "foods"}
        </span>
      </div>
      <div className="space-y-3">
        {group.meals.map((meal) => (
          <MealCard key={meal.id} meal={meal} timezone={timezone} />
        ))}
      </div>
    </section>
  );
}

function formatDayHeading(dayKey: string, tz: string): string {
  const { year, month, day } = parseDayKey(dayKey);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  const now = new Date();
  const startToday = startOfDayInTz(tz, now);
  const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);

  if (date >= startToday) return "Today";
  if (date >= startYesterday) return "Yesterday";

  const daysAgo = Math.floor(
    (startToday.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (daysAgo < 7) {
    return date.toLocaleDateString("en-US", { timeZone: tz, weekday: "long" });
  }

  const sameYear = getYearInTz(date, tz) === getYearInTz(now, tz);
  return date.toLocaleDateString("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

function getYearInTz(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
  }).formatToParts(date);
  return parseInt(parts.find((p) => p.type === "year")?.value ?? "0", 10);
}
