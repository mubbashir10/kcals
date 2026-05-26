-- Make Recipe.totalWeightG optional. When null, the app derives it as
-- the sum of ingredient grams. Existing rows keep their values; only
-- new recipes can be created without an explicit weight.
ALTER TABLE "Recipe" ALTER COLUMN "totalWeightG" DROP NOT NULL;
