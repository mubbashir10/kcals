-- Lactation (breastfeeding) support on Profile. Adds the energy cost of
-- making milk on top of TDEE so a nursing mother's maintenance calories
-- hold her weight. lactationStage/Basis are only meaningful while
-- breastfeeding. Defaults keep every existing row as "not breastfeeding".

ALTER TABLE "Profile" ADD COLUMN "lactationStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Profile" ADD COLUMN "lactationStage" TEXT;
ALTER TABLE "Profile" ADD COLUMN "lactationBasis" TEXT NOT NULL DEFAULT 'maintain';
