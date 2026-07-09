-- Let a user turn the native Health Connect integration off. The Android shell
-- reads this before touching the API, so "off" suppresses the permission prompt
-- as well as the sync. Existing users had it implicitly on.
ALTER TABLE "Profile" ADD COLUMN "healthSync" BOOLEAN NOT NULL DEFAULT true;
