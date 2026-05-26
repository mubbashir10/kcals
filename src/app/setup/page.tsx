import { ArrowLeft } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { SetupForm, type InitialProfile } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const userId = await requireUserId();
  const existing = await db.profile.findUnique({ where: { userId } });
  const initial: InitialProfile = existing
    ? {
        sex: existing.sex as "male" | "female",
        age: existing.age,
        heightCm: existing.heightCm,
        weightKg: existing.weightKg,
        bodyFatPct: existing.bodyFatPct,
        units: existing.units as "metric" | "imperial",
        timezone: existing.timezone,
        activityMode: existing.activityMode as "estimate" | "override",
        stepsPerDay: existing.stepsPerDay,
        liftingSessionsPerWeek: existing.liftingSessionsPerWeek,
        liftingMinutesPerSession: existing.liftingMinutesPerSession,
        cardioSessionsPerWeek: existing.cardioSessionsPerWeek,
        cardioMinutesPerSession: existing.cardioMinutesPerSession,
        activeKcalOverride: existing.activeKcalOverride,
      }
    : null;

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      {existing && (
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
            <span className="text-sm font-semibold tracking-tight">
              Profile
            </span>
          </div>
        </header>
      )}

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            {existing ? "Profile" : "Tell us about you"}
          </h1>
          {!existing && (
            <p className="mt-2 text-sm text-muted-foreground">
              We'll use this to calculate your daily calorie needs.
            </p>
          )}
        </div>

        <SetupForm initial={initial} />
      </main>
    </div>
  );
}
