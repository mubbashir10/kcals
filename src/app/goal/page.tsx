import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { requireUserId } from "@/lib/session";
import { loadDailyStats } from "@/lib/daily-stats";
import { isGoalPace, isGoalType } from "@/lib/goal";
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
  const stats = await loadDailyStats(userId);
  // Onboarding must finish first.
  if (!stats) redirect("/setup");
  const { profile, tdee, calorieGoal } = stats;

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
          <span className="text-sm font-semibold tracking-tight">Goal</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Goal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            What you&rsquo;re aiming for — drives your daily calorie target.
          </p>
        </div>

        <GoalSettings
          initial={{
            type: isGoalType(profile.goalType) ? profile.goalType : "maintain",
            pace: isGoalPace(profile.goalPace) ? profile.goalPace : null,
            trackKcal: profile.trackKcal,
            tdee,
            effectiveTarget: calorieGoal,
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
            <h2 className="px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Breastfeeding
            </h2>
            <LactationSettings
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
