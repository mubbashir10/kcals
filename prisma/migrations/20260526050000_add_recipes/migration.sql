-- Recipes — private compositions of ingredient foods. See schema.prisma
-- for the full rationale; quick recap:
--   * One Recipe per user, with N RecipeIngredient rows.
--   * totalWeightG is user-set (cooked weight), not derived from ingredients.
--   * Each ingredient snapshots its per-100g nutrient profile at add time
--     so upstream USDA/CustomFood edits never silently rewrite history.
--   * Food rows get a nullable recipeId so diary rows can point back at
--     the recipe they came from (SetNull on delete).

CREATE TABLE "Recipe" (
    "id"           SERIAL PRIMARY KEY,
    "userId"       TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "totalWeightG" DOUBLE PRECISION NOT NULL,
    "servings"     DOUBLE PRECISION,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Recipe_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Recipe_userId_createdAt_idx" ON "Recipe" ("userId", "createdAt");

CREATE TABLE "RecipeIngredient" (
    "id"             SERIAL PRIMARY KEY,
    "recipeId"       INTEGER NOT NULL,
    "fdcId"          INTEGER,
    "name"           TEXT NOT NULL,
    "brand"          TEXT,
    "per100Kcal"     DOUBLE PRECISION NOT NULL,
    "per100ProteinG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "per100CarbsG"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "per100FatG"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grams"          DOUBLE PRECISION NOT NULL,
    "position"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeIngredient_recipeId_fkey"
      FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient" ("recipeId");

-- Link diary rows back to their source recipe (nullable; older rows have none).
ALTER TABLE "Food"
  ADD COLUMN "recipeId" INTEGER,
  ADD CONSTRAINT "Food_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Food_recipeId_idx" ON "Food" ("recipeId");
