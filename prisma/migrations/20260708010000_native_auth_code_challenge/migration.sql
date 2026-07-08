-- Bind each native-auth code to a client-held verifier (PKCE-style) so a
-- leaked/intercepted one-time code can't be redeemed without the WebView that
-- started sign-in. Codes are 60s single-use and transient, so clear the table
-- before adding the NOT NULL column.
DELETE FROM "NativeAuthCode";

ALTER TABLE "NativeAuthCode" ADD COLUMN "challenge" TEXT NOT NULL;
