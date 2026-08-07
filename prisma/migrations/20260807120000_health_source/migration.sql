-- The app behind a synced day, so its provenance line can show the name and
-- icon Android itself shows for it instead of a generic "your band". The
-- shell posts these; only it can resolve a package to a label and an icon.
--
-- Keyed by the label because that is what ActivityLog.source already stores,
-- so a day looks its source up by the string it is holding.
CREATE TABLE "HealthSource" (
  "id" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HealthSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HealthSource_userId_name_key" ON "HealthSource"("userId", "name");

ALTER TABLE "HealthSource"
  ADD CONSTRAINT "HealthSource_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
