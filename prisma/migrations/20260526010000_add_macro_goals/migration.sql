-- Per-macro goal mode (auto / custom / off) + optional custom grams.
-- "auto" derives the gram target from the calorie goal × default split.
-- "custom" uses the *GoalG column. "off" hides the goal and progress bar.

ALTER TABLE "Profile" ADD COLUMN "proteinGoalMode" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "Profile" ADD COLUMN "proteinGoalG"    INTEGER;
ALTER TABLE "Profile" ADD COLUMN "carbsGoalMode"   TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "Profile" ADD COLUMN "carbsGoalG"      INTEGER;
ALTER TABLE "Profile" ADD COLUMN "fatGoalMode"     TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "Profile" ADD COLUMN "fatGoalG"        INTEGER;
