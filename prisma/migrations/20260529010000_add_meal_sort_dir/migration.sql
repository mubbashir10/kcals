-- Order meals are listed in by loggedAt: "desc" = newest first (the prior
-- home default), "asc" = oldest first. Default "desc" so existing rows keep
-- the current behaviour.
ALTER TABLE "Profile" ADD COLUMN "mealSortDir" TEXT NOT NULL DEFAULT 'desc';
