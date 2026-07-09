-- Record which app Health Connect attributed a day's steps/calories to, so the
-- dashboard can say "Synced from Mi Fitness" instead of guessing "your band".
-- Null for manual entries and for every row written before this column.
ALTER TABLE "ActivityLog" ADD COLUMN "source" TEXT;
