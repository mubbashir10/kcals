-- Allow a user-entered kcal/day deficit or surplus when goalPace = "custom".
-- Preset paces (mild/moderate/aggressive) still derive from the table in
-- src/lib/goal.ts; this column is only read when pace is "custom".

ALTER TABLE "Profile" ADD COLUMN "goalPaceKcal" INTEGER;
