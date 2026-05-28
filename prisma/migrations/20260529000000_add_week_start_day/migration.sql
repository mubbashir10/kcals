-- Which weekday the week summary starts on. 0=Sunday … 6=Saturday (matches
-- JS getUTCDay). Default 1 = Monday so existing rows backfill to Monday.
ALTER TABLE "Profile" ADD COLUMN "weekStartDay" INTEGER NOT NULL DEFAULT 1;
