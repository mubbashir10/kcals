-- Add goal feature to Profile. goalType drives the "effective" calorie
-- target used by the ring + macros; goalPace is only meaningful when
-- goalType is loss or gain.

ALTER TABLE "Profile" ADD COLUMN "goalType" TEXT NOT NULL DEFAULT 'maintain';
ALTER TABLE "Profile" ADD COLUMN "goalPace" TEXT;
