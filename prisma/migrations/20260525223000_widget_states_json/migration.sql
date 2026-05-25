-- Replace per-widget columns (widgetMaintenance, widgetWeight) with a single
-- JSON map column (widgetStates) so adding future widgets doesn't require
-- a schema change.

ALTER TABLE "Profile" ADD COLUMN "widgetStates" TEXT NOT NULL DEFAULT '{}';

-- Backfill from the two old columns so existing users don't lose their state.
UPDATE "Profile"
SET "widgetStates" = jsonb_build_object(
  'maintenance', "widgetMaintenance",
  'weight',      "widgetWeight"
)::text;

ALTER TABLE "Profile" DROP COLUMN "widgetMaintenance";
ALTER TABLE "Profile" DROP COLUMN "widgetWeight";
