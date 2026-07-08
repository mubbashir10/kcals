import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Flame, Scale } from "lucide-react";

import { AppLink } from "@/components/app-link";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { CalorieRing } from "@/components/calorie-ring";
import { MacroCard } from "@/components/macro-card";
import { metricColor } from "@/lib/metric-colors";
import { ReadOnlyMealCard } from "@/components/read-only-meal-card";
import { db } from "@/lib/db";
import { areFriends } from "@/lib/friends";
import { loadDailyStats } from "@/lib/daily-stats";
import { getSession } from "@/lib/session";
import { formatLongDateInTz } from "@/lib/clock";
import { displayWeight, formatWeightDelta, type Units } from "@/lib/bmr";

export const dynamic = "force-dynamic";

export default async function FriendViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: friendId } = await params;

  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  if (friendId === userId) redirect("/");

  if (!(await areFriends(userId, friendId))) {
    notFound();
  }

  const friend = await db.user.findUnique({
    where: { id: friendId },
    select: { id: true, name: true, email: true, image: true },
  });
  if (!friend) notFound();

  const now = new Date();
  const stats = await loadDailyStats(friendId, now, { readOnly: true });

  const displayName = friend.name ?? friend.email;
  const initial =
    friend.name?.trim()[0]?.toUpperCase() ??
    friend.email.trim()[0]?.toUpperCase() ??
    "?";

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-6">
          <AppLink
            href="/friends"
            direction="back"
            aria-label="Back"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </AppLink>
          <span className="text-sm font-semibold tracking-tight truncate">
            {displayName}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <div className="mb-8 flex items-center gap-4">
          <Avatar className="h-14 w-14 ring-1 ring-border">
            {friend.image && (
              <AvatarImage src={friend.image} referrerPolicy="no-referrer" />
            )}
            <AvatarFallback className="bg-muted text-base font-semibold">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {displayName}
            </h1>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {stats
                ? formatLongDateInTz(now, stats.tz)
                : "Hasn’t finished setup yet."}
            </p>
          </div>
        </div>

        {!stats ? (
          <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-12 text-center shadow-none">
            <p className="text-sm text-muted-foreground">
              {displayName} hasn’t finished setting up their profile yet.
            </p>
          </Card>
        ) : (
          <FriendDayView
            stats={stats}
            displayName={displayName}
          />
        )}
      </main>
    </div>
  );
}

function FriendDayView({
  stats,
  displayName,
}: {
  stats: NonNullable<Awaited<ReturnType<typeof loadDailyStats>>>;
  displayName: string;
}) {
  const {
    profile,
    tz,
    tdee,
    calorieGoal,
    meals,
    latestWeight,
    delta7dKg,
    consumed,
    foodCount,
    macroGoals,
  } = stats;

  const units = profile.units as Units;

  return (
    <>
      <Card className="relative rounded-3xl border-border/60 px-6 py-12 shadow-card-lg">
        <div className="flex flex-col items-center">
          <CalorieRing
            consumed={Math.round(consumed.kcal)}
            goal={calorieGoal}
            mode="remaining"
          />
        </div>
      </Card>

      <section className="mt-4 grid grid-cols-3 gap-3">
        <MacroCard
          label="Protein"
          value={Math.round(consumed.protein)}
          goal={macroGoals.protein}
          color={metricColor.protein}
        />
        <MacroCard
          label="Carbs"
          value={Math.round(consumed.carbs)}
          goal={macroGoals.carbs}
          color={metricColor.carbs}
        />
        <MacroCard
          label="Fat"
          value={Math.round(consumed.fat)}
          goal={macroGoals.fat}
          color={metricColor.fat}
        />
      </section>

      <section className="mt-8 grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-border/60 p-5 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Flame className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em]">
              Maintenance
            </span>
          </div>
          <div className="text-2xl font-semibold tabular-nums tracking-tight">
            {Math.round(tdee).toLocaleString()}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              kcal
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Daily energy goal
          </div>
        </Card>

        <Card className="rounded-2xl border-border/60 p-5 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Scale className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em]">
              Weight
            </span>
          </div>
          {latestWeight ? (
            <>
              <div className="text-2xl font-semibold tabular-nums tracking-tight">
                {(() => {
                  const w = displayWeight(latestWeight.weightKg, units);
                  return `${w.value} ${w.unit}`;
                })()}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                {delta7dKg === null
                  ? "Single log so far"
                  : `${formatWeightDelta(delta7dKg, units).signed} this week`}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">No logs yet</div>
          )}
        </Card>
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">
            {displayName.split(" ")[0]}’s meals today
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {meals.length === 0
              ? "nothing yet"
              : `${meals.length} ${meals.length === 1 ? "meal" : "meals"} · ${foodCount} ${foodCount === 1 ? "food" : "foods"}`}
          </span>
        </div>

        {meals.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-12 text-center shadow-none">
            <p className="text-sm text-muted-foreground">
              No meals logged yet today.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {meals.map((m) => (
              <ReadOnlyMealCard key={m.id} meal={m} timezone={tz} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

