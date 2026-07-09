import { ArrowLeft } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { requireProfile } from "@/lib/session";
import { db } from "@/lib/db";
import { dayKeyInTz } from "@/lib/clock";
import type { Units } from "@/lib/bmr";
import { parseWidgetStates } from "@/lib/widget-order";
import { ThemeSettings } from "@/components/theme-settings";
import { UnitsSettings } from "@/components/units-settings";
import { WeekStartSettings } from "@/components/week-start-settings";
import { WidgetsSettings } from "@/components/widgets-settings";
import { DefaultMealsSettings } from "@/components/default-meals-settings";
import { HealthConnectSettings } from "@/components/health-connect-settings";
import { VersionBadge } from "@/components/version-badge";
import { listDefaultMeals } from "@/app/actions/default-meals";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { userId, profile } = await requireProfile();
  const defaultMeals = await listDefaultMeals();

  // Today's Health Connect sync (steps + active kcal), for the native card's
  // status line. Written by the native app via POST /api/health/sync.
  const todayActivity = await db.activityLog.findUnique({
    where: {
      userId_dayKey: { userId, dayKey: dayKeyInTz(profile.timezone || "UTC") },
    },
    select: { steps: true, wearableKcal: true },
  });

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-3 px-6">
          <AppLink
            href="/"
            direction="back"
            aria-label="Back"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </AppLink>
          <span className="text-sm font-semibold tracking-tight">Settings</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Customize your home dashboard.
          </p>
        </div>

        <section className="mb-8 space-y-3">
          <h2 className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Preferences
          </h2>
          <ThemeSettings />
          <UnitsSettings
            initial={profile.units as Units}
          />
          <WeekStartSettings initial={profile.weekStartDay} />
          <DefaultMealsSettings initial={defaultMeals} />
          <HealthConnectSettings
            steps={todayActivity?.steps ?? null}
            activeKcal={todayActivity?.wearableKcal ?? null}
          />
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Widgets
          </h2>
          <WidgetsSettings
            initial={{
              states: parseWidgetStates(profile.widgetStates),
              calorieDisplay: profile.calorieDisplay as
                | "remaining"
                | "consumed",
            }}
          />
        </section>

        <VersionBadge />
      </main>
    </div>
  );
}
