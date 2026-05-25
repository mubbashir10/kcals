/*
  Warnings:

  - You are about to drop the column `brand` on the `Meal` table. All the data in the column will be lost.
  - You are about to drop the column `carbsG` on the `Meal` table. All the data in the column will be lost.
  - You are about to drop the column `fatG` on the `Meal` table. All the data in the column will be lost.
  - You are about to drop the column `fdcId` on the `Meal` table. All the data in the column will be lost.
  - You are about to drop the column `grams` on the `Meal` table. All the data in the column will be lost.
  - You are about to drop the column `kcal` on the `Meal` table. All the data in the column will be lost.
  - You are about to drop the column `proteinG` on the `Meal` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Food" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mealId" INTEGER NOT NULL,
    "fdcId" INTEGER,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "grams" REAL NOT NULL,
    "kcal" REAL NOT NULL,
    "proteinG" REAL NOT NULL DEFAULT 0,
    "carbsG" REAL NOT NULL DEFAULT 0,
    "fatG" REAL NOT NULL DEFAULT 0,
    "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Food_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Meal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Meal" ("createdAt", "id", "loggedAt", "name") SELECT "createdAt", "id", "loggedAt", "name" FROM "Meal";
DROP TABLE "Meal";
ALTER TABLE "new_Meal" RENAME TO "Meal";
CREATE INDEX "Meal_loggedAt_idx" ON "Meal"("loggedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Food_mealId_idx" ON "Food"("mealId");

-- CreateIndex
CREATE INDEX "Food_loggedAt_idx" ON "Food"("loggedAt");
