-- Health Connect used to sync only today, so a day froze at whatever partial
-- total was on screen when the app last had focus. It now backfills the last
-- week, which means it rewrites past days — so hand-entered days need to be
-- distinguishable from synced ones or the backfill would silently clobber them.
--
-- Existing rows default to false: before this column, every past-day row the
-- sync could plausibly overwrite was either auto-created (empty) or written by
-- the sync itself, and there is no way to tell a hand entry apart after the
-- fact. From here on, the ActivityCard marks its writes.
ALTER TABLE "ActivityLog" ADD COLUMN "manual" BOOLEAN NOT NULL DEFAULT false;
