-- Recurring meal templates. Each day, a default with no matching real meal
-- shows as a placeholder; logging food into it creates the real Meal row.
-- Users with no rows here see unchanged behavior.

CREATE TABLE "DefaultMeal" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timeHhmm" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefaultMeal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DefaultMeal_userId_position_idx" ON "DefaultMeal"("userId", "position");

ALTER TABLE "DefaultMeal" ADD CONSTRAINT "DefaultMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
