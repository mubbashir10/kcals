-- Native app (Capacitor Android) tables.
--
-- NativeAuthCode: short-lived, single-use codes that bridge the system-browser
-- Google OAuth flow back into the native WebView (Google blocks OAuth inside
-- embedded WebViews, so native sign-in runs in the system browser and hands the
-- session back via one of these codes).
-- PushToken: FCM device tokens for push notifications, one row per device.

CREATE TABLE "NativeAuthCode" (
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NativeAuthCode_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "NativeAuthCode_userId_idx" ON "NativeAuthCode"("userId");

CREATE INDEX "NativeAuthCode_expiresAt_idx" ON "NativeAuthCode"("expiresAt");

ALTER TABLE "NativeAuthCode" ADD CONSTRAINT "NativeAuthCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PushToken" (
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("token")
);

CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
