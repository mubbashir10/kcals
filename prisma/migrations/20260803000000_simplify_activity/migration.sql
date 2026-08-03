-- Simplify the calorie estimation to one rule at both levels: a supplied
-- active-calorie total wins over anything computed from steps and workouts.
-- That removes the "mode" columns, and the burn snapshot collapses to
-- bmrKcal + tdeeKcal (active energy is the gap between them).

-- The wearable total and a hand-typed number are the same thing now.
ALTER TABLE "ActivityLog" RENAME COLUMN "wearableKcal" TO "activeKcal";

-- The four snapshot columns reached the live database through `db push`, not
-- through any migration, so a replay from scratch has never had them and the
-- DROPs below would fail on the shadow database. Create whatever is missing
-- first; on the real database every one of these is a no-op.
ALTER TABLE "ActivityLog"
  ADD COLUMN IF NOT EXISTS "bmrKcal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "tdeeKcal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "defaultActiveKcal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "overrideActiveKcal" DOUBLE PRECISION;

-- Rows written in the old "estimate" mode may carry a total they never used;
-- under the new rule it would win, so clear it.
UPDATE "ActivityLog" SET "activeKcal" = NULL WHERE "mode" = 'estimate';

-- Backfill any row that never got a burn written to it.
UPDATE "ActivityLog"
SET "tdeeKcal" = "bmrKcal" + COALESCE("overrideActiveKcal", "defaultActiveKcal")
WHERE "tdeeKcal" IS NULL
  AND "bmrKcal" IS NOT NULL
  AND COALESCE("overrideActiveKcal", "defaultActiveKcal") IS NOT NULL;

ALTER TABLE "ActivityLog"
  DROP COLUMN "mode",
  DROP COLUMN "defaultActiveKcal",
  DROP COLUMN "overrideActiveKcal";

-- Same on the profile: the standing figure simply wins when it's set, so a
-- profile that was on "estimate" must not keep a stale one lying around.
UPDATE "Profile" SET "activeKcalOverride" = NULL WHERE "activityMode" <> 'override';
ALTER TABLE "Profile" DROP COLUMN "activityMode";
