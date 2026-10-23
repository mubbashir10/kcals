-- OAuth for AI assistants connecting to /api/mcp. kcals is its own
-- authorization server: clients register (OAuthClient, DCR only — CIMD clients
-- are fetched, not stored), a user approves one on /oauth/authorize
-- (OAuthCode, single-use), and the token endpoint turns that into a grant
-- holding the live access/refresh token pair (OAuthGrant). Every token and
-- code is stored as its SHA-256, never in the clear.
CREATE TABLE "OAuthClient" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "redirectUris" TEXT[],
  "secretHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OAuthCode" (
  "codeHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "codeChallenge" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OAuthCode_pkey" PRIMARY KEY ("codeHash")
);

CREATE INDEX "OAuthCode_userId_idx" ON "OAuthCode"("userId");

ALTER TABLE "OAuthCode"
  ADD CONSTRAINT "OAuthCode_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OAuthGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "accessTokenHash" TEXT NOT NULL,
  "accessExpiresAt" TIMESTAMP(3) NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OAuthGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthGrant_accessTokenHash_key" ON "OAuthGrant"("accessTokenHash");
CREATE UNIQUE INDEX "OAuthGrant_refreshTokenHash_key" ON "OAuthGrant"("refreshTokenHash");
CREATE INDEX "OAuthGrant_userId_idx" ON "OAuthGrant"("userId");

ALTER TABLE "OAuthGrant"
  ADD CONSTRAINT "OAuthGrant_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
