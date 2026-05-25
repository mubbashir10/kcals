-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "age" INTEGER NOT NULL,
    "sex" TEXT NOT NULL,
    "heightCm" REAL NOT NULL,
    "weightKg" REAL NOT NULL,
    "bodyFatPct" REAL,
    "units" TEXT NOT NULL DEFAULT 'metric',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "activityMode" TEXT NOT NULL DEFAULT 'estimate',
    "stepsPerDay" INTEGER,
    "liftingSessionsPerWeek" INTEGER,
    "liftingMinutesPerSession" INTEGER,
    "cardioSessionsPerWeek" INTEGER,
    "cardioMinutesPerSession" INTEGER,
    "activeKcalOverride" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Profile" ("activeKcalOverride", "activityMode", "age", "bodyFatPct", "cardioMinutesPerSession", "cardioSessionsPerWeek", "createdAt", "heightCm", "id", "liftingMinutesPerSession", "liftingSessionsPerWeek", "sex", "stepsPerDay", "units", "updatedAt", "weightKg") SELECT "activeKcalOverride", "activityMode", "age", "bodyFatPct", "cardioMinutesPerSession", "cardioSessionsPerWeek", "createdAt", "heightCm", "id", "liftingMinutesPerSession", "liftingSessionsPerWeek", "sex", "stepsPerDay", "units", "updatedAt", "weightKg" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
