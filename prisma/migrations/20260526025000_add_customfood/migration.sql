-- Baseline create for the CustomFood table. Historically this table was
-- introduced via `prisma db push` and never had its own migration; the
-- follow-up `add_customfood_source` migration ALTERs it. This file fills
-- the gap so the shadow DB and any new environment can replay history.
CREATE TABLE "CustomFood" (
    "id"            SERIAL PRIMARY KEY,
    "createdById"   TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "brand"         TEXT,
    "kcal"          DOUBLE PRECISION NOT NULL,
    "proteinG"      DOUBLE PRECISION,
    "carbsG"        DOUBLE PRECISION,
    "fatG"          DOUBLE PRECISION,
    "fiberG"        DOUBLE PRECISION,
    "sugarG"        DOUBLE PRECISION,
    "saturatedFatG" DOUBLE PRECISION,
    "sodiumMg"      DOUBLE PRECISION,
    "cholesterolMg" DOUBLE PRECISION,
    "servingSizeG"  DOUBLE PRECISION,
    "servingLabel"  TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomFood_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CustomFood_name_idx"      ON "CustomFood" ("name");
CREATE INDEX "CustomFood_createdAt_idx" ON "CustomFood" ("createdAt");
