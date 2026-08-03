import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { requireUserId } from "@/lib/session";
import { loadDailyStats } from "@/lib/daily-stats";
import { isMacroMode } from "@/lib/macros";
import {
  isLactationBasis,
  isLactationStage,
  isLactationStatus,
} from "@/lib/lactation";
import { GoalSettings } from "@/components/goal-settings";
import { LactationSettings } from "@/components/lactation-settings";

export const dynamic = "force-dynamic";

export default async function GoalPage() {
  const userId = await requireUserId();

  // TDEE = maintenance kcal; shown in the Maintain card and used as the
  // fallback target for Track mode when the user leaves the kcal field blank.
  // The typical day, not today: picking a goal is a standing choice, and
  // today's burn is still part forecast until today ends.
  const stats = await loadDailyStats(userId);
  // Onboarding must finish first.
  if (!stats) redirect("/setup");
  const { profile, typical, bmr, goalType, goalPace } = stats;

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
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Goal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            What you&rsquo;re aiming for — drives your daily calorie target.
          </p>
        </div>

        <GoalSettings
          initial={{
            type: goalType,
            pace: goalPace,
            trackKcal: profile.trackKcal,
            tdee: typical.tdee,
            bmr: bmr.kcal,
            effectiveTarget: typical.calorieGoal,
            macros: {
              protein: {
                mode: isMacroMode(profile.proteinGoalMode)
                  ? profile.proteinGoalMode
                  : "auto",
                g: profile.proteinGoalG,
              },
              carbs: {
                mode: isMacroMode(profile.carbsGoalMode)
                  ? profile.carbsGoalMode
                  : "auto",
                g: profile.carbsGoalG,
              },
              fat: {
                mode: isMacroMode(profile.fatGoalMode)
                  ? profile.fatGoalMode
                  : "auto",
                g: profile.fatGoalG,
              },
            },
          }}
          unitsLabel={profile.units === "imperial" ? "lb" : "kg"}
        />

        {profile.sex === "female" && (
          <div className="mt-8 space-y-3">
            <h2 className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Breastfeeding
            </h2>
            <LactationSettings
              sex={profile.sex}
              initial={{
                status: isLactationStatus(profile.lactationStatus)
                  ? profile.lactationStatus
                  : "none",
                stage: isLactationStage(profile.lactationStage)
                  ? profile.lactationStage
                  : "0-6mo",
                basis: isLactationBasis(profile.lactationBasis)
                  ? profile.lactationBasis
                  : "maintain",
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
