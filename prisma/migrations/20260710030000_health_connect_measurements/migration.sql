-- Two-way Health Connect measurement sync (weight, height, body fat).
--
-- WeightLog learns where each entry came from: kcals-native rows (hcId NULL)
-- are exported to Health Connect with updatedAt as the record version, rows
-- imported FROM Health Connect keep the source record's id + app label so
-- they're never imported twice nor echoed back out.
ALTER TABLE "WeightLog" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "WeightLog" ADD COLUMN "hcId" TEXT;
ALTER TABLE "WeightLog" ADD COLUMN "source" TEXT;
CREATE UNIQUE INDEX "WeightLog_userId_hcId_key" ON "WeightLog"("userId", "hcId");

-- Last external height / body-fat record applied to the profile. The id makes
-- imports one-shot (new record wins, later user edits stick); the value gates
-- export so an imported measurement never bounces back to Health Connect.
ALTER TABLE "Profile" ADD COLUMN "hcHeightId" TEXT;
ALTER TABLE "Profile" ADD COLUMN "hcHeightCm" DOUBLE PRECISION;
ALTER TABLE "Profile" ADD COLUMN "hcBodyFatId" TEXT;
ALTER TABLE "Profile" ADD COLUMN "hcBodyFatPct" DOUBLE PRECISION;

-- Ledger of Health Connect records already imported once, kept apart from the
-- rows they created so deleting an imported weigh-in doesn't resurrect it.
CREATE TABLE "HealthConnectImport" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "hcId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthConnectImport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HealthConnectImport_userId_hcId_key" ON "HealthConnectImport"("userId", "hcId");

ALTER TABLE "HealthConnectImport" ADD CONSTRAINT "HealthConnectImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
