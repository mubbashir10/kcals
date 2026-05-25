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
    "activityMode" TEXT NOT NULL DEFAULT 'estimate',
    "stepsPerDay" INTEGER,
    "liftingSessionsPerWeek" INTEGER,
    "activeKcalOverride" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Profile" ("age", "bodyFatPct", "createdAt", "heightCm", "id", "sex", "units", "updatedAt", "weightKg") SELECT "age", "bodyFatPct", "createdAt", "heightCm", "id", "sex", "units", "updatedAt", "weightKg" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
