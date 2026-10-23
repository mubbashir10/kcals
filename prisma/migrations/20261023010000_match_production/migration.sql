-- Bring a database built from these migrations level with production, and
-- production level with schema.prisma. Every statement is idempotent, so it
-- replays on a fresh database and is a no-op wherever it already holds.

-- Profile.widgetOrder reached production without a migration of its own…
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "widgetOrder" TEXT;

-- …and goalPaceKcal (20260526020000_add_goal_pace_kcal) left it the same way.
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "goalPaceKcal";

-- Trigram search for CustomFood.name. prisma/manual-indexes.sql carried this
-- since May, waiting for the Prisma CLI to work here, but it never reached
-- production. The index is declared in schema.prisma; the extension it needs
-- lives only here (declaring extensions in the schema takes a preview flag).
-- CustomFood is small, so a plain CREATE INDEX locks writes only for a moment.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "CustomFood_name_trgm_idx" ON "CustomFood" USING GIN ("name" gin_trgm_ops);
