-- "Just track" goal mode lets users set their own daily kcal target instead
-- of deriving it from TDEE. Nullable: when unset (or any other goal type
-- is active), the dashboard falls back to TDEE.
ALTER TABLE "Profile" ADD COLUMN "trackKcal" INTEGER;
