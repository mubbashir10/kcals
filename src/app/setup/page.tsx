import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { SetupForm, type InitialProfile } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const existing = await db.profile.findFirst();
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
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.92_0.06_70_/_0.6)_0%,transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.35_0.08_40_/_0.4)_0%,transparent_70%)]"
      />

      {existing && (
        <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-md items-center gap-3 px-6">
            <Link
              href="/"
              aria-label="Back"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-sm font-semibold tracking-tight">
              Profile
            </span>
          </div>
        </header>
      )}

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">
            {existing ? "Edit your profile" : "Tell us about you"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We'll use this to calculate your daily calorie needs.
          </p>
        </div>

        <SetupForm initial={initial} />
      </main>
    </div>
  );
}
