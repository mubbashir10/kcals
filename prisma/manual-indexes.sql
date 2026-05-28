-- Indexes applied directly to the database, outside Prisma's managed
-- migrations. We keep them here because the Prisma CLI can't run in the
-- local environment (an @prisma/dev ESM/CJS bug crashes every command),
-- so `prisma migrate` isn't usable to generate/track these.
--
-- HOW TO APPLY: paste this into the Neon SQL Editor (dashboard → SQL
-- Editor) and run it, or `node scripts/apply-trgm-index.mjs` from a
-- network that can reach Neon on 5432. All statements are idempotent.
--
-- When the Prisma CLI works again, fold this into schema.prisma:
--   generator:  previewFeatures = ["postgresqlExtensions"]   (if still preview in v7)
--   datasource: extensions = [pg_trgm]
--   CustomFood: @@index([name(ops: raw("gin_trgm_ops"))], type: Gin)
-- then delete this file once a real migration covers it.

-- Trigram search support for CustomFood.name. The food search ANDs
-- `name ILIKE '%token%'` per token; a plain btree can't serve substring
-- ILIKE, but a GIN trigram index can. Matters as the shared community
-- CustomFood table grows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Plain CREATE INDEX is fine here — CustomFood is small, so the build
-- locks writes only momentarily. For a large table, use instead:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS ... (run on a *direct*,
--   non-pooled connection; CONCURRENTLY can't run in a txn/pooler).
CREATE INDEX IF NOT EXISTS "CustomFood_name_trgm_idx"
  ON "CustomFood" USING gin ("name" gin_trgm_ops);
