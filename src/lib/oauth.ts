// kcals as an OAuth 2.1 authorization server, for AI assistants (Claude,
// ChatGPT, Cursor, …) connecting to the MCP endpoint at /api/mcp.
//
// The flow, end to end:
//   1. The assistant hits /api/mcp, gets a 401 pointing at the protected
//      resource metadata, and from there finds this server's metadata
//      (/.well-known/oauth-authorization-server).
//   2. It identifies itself — either a client_id that is an HTTPS URL to its
//      own metadata document (CIMD, what current clients do), or one it got
//      from /api/oauth/register (DCR, what older ones do).
//   3. It sends the user to /oauth/authorize, which signs them in with Google
//      like any page, shows who is asking, and on Allow mints a one-time code.
//   4. /api/oauth/token swaps the code (PKCE S256, always) for an access token
//      and a refresh token, both opaque and stored only as SHA-256 hashes.
//   5. /api/mcp resolves the bearer to a user via verifyAccessToken below.
//
// There's one scope: an approved assistant can do anything the user can do in
// the app. The consent screen says so, and Settings can disconnect it. There's
// also one resource — the MCP endpoint — so a token's audience is checked when
// it's requested (RFC 8707) and needn't be stored.
//
// URLs are built on the request's own origin (getRequestOrigin in lib/site.ts):
// clients check the issuer and resource against the host they used. CORS for
// these endpoints is set once in next.config.ts.
//
// Server-side only.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import {
  OAuthErrorCode,
  type AuthInfo,
  type OAuthClientInformationFull,
  type OAuthErrorResponse,
  type OAuthMetadata,
  type OAuthTokens,
} from "@modelcontextprotocol/server";

import { db } from "@/lib/db";

export const MCP_PATH = "/api/mcp";
export const OAUTH_SCOPE = "kcals";

const CODE_TTL_MS = 5 * 60_000;
const ACCESS_TTL_S = 60 * 60;
// Sliding: every refresh pushes it out again, so an assistant in regular use
// never has to send the user back through consent.
const REFRESH_TTL_MS = 90 * 86400_000;

// CIMD documents are tiny; anything bigger isn't one.
const CLIENT_METADATA_MAX_BYTES = 16_384;
const CLIENT_METADATA_TIMEOUT_MS = 5_000;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** The resource identifier tokens are minted for — the MCP endpoint URL. */
export function mcpResourceUrl(origin: string): string {
  return `${origin}${MCP_PATH}`;
}

/** What an OAuth endpoint answers: an HTTP status and a JSON body. */
export type OAuthResult = { status: number; body: object };

const oauthError = (
  status: number,
  error: OAuthErrorCode,
  error_description: string
): OAuthResult => ({
  status,
  body: { error, error_description } satisfies OAuthErrorResponse,
});

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: [
      "none",
      "client_secret_post",
      "client_secret_basic",
    ],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [OAUTH_SCOPE],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  } satisfies OAuthMetadata;
}

// Allowed redirect targets: https anywhere, http only back to this machine
// (CLI clients listen on a loopback port), and a native app's own scheme. The
// schemes a browser would execute or read locally are refused outright.
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isAllowedRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return LOOPBACK_HOSTS.has(url.hostname);
  return !BLOCKED_SCHEMES.has(url.protocol);
}

// Exact match, except that a loopback redirect may come back on any port
// (RFC 8252 §7.3) — CLI clients pick a free port per sign-in.
function redirectUriMatches(registered: string, presented: string): boolean {
  if (registered === presented) return true;
  try {
    const r = new URL(registered);
    const p = new URL(presented);
    return (
      r.protocol === "http:" &&
      LOOPBACK_HOSTS.has(r.hostname) &&
      r.hostname === p.hostname &&
      r.protocol === p.protocol &&
      r.pathname === p.pathname &&
      r.search === p.search
    );
  } catch {
    return false;
  }
}

/** A CIMD client's id is the URL of its metadata document; a DCR one's isn't. */
const isMetadataDocumentClient = (clientId: string) => clientId.startsWith("https://");

/** The name a client gave itself, cleaned for display on the consent screen. */
function clientNameOf(raw: unknown, fallback: string): string {
  return typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 100) : fallback;
}

type OAuthClientInfo = { id: string; name: string; redirectUris: string[] };

// A CIMD client_id is the URL of its metadata. Fetching a URL a stranger
// handed us is an SSRF door, so: https only, no IP literals or local names,
// no redirects, a short timeout and a size cap.
async function fetchClientMetadataDocument(
  clientId: string
): Promise<OAuthClientInfo | null> {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hash || url.username || url.password) {
    return null;
  }
  const host = url.hostname;
  if (
    LOOPBACK_HOSTS.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^[\d.]+$/.test(host) ||
    host.startsWith("[")
  ) {
    return null;
  }

  try {
    const res = await fetch(url, {
      redirect: "error",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(CLIENT_METADATA_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > CLIENT_METADATA_MAX_BYTES) return null;
    const doc = JSON.parse(text) as Record<string, unknown>;

    // The document must name itself, or anyone could point at someone
    // else's metadata and borrow its redirect URIs.
    if (doc.client_id !== clientId) return null;
    const method = doc.token_endpoint_auth_method;
    if (method !== undefined && method !== "none") return null;
    const redirectUris = Array.isArray(doc.redirect_uris)
      ? doc.redirect_uris.filter(
          (u): u is string => typeof u === "string" && isAllowedRedirectUri(u)
        )
      : [];
    if (redirectUris.length === 0) return null;

    return { id: clientId, name: clientNameOf(doc.client_name, host), redirectUris };
  } catch {
    return null;
  }
}

async function resolveClient(clientId: string): Promise<OAuthClientInfo | null> {
  if (isMetadataDocumentClient(clientId)) {
    return fetchClientMetadataDocument(clientId);
  }
  return db.oAuthClient.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, redirectUris: true },
  });
}

// ─── Dynamic Client Registration (RFC 7591) ─────────────────────────────

export async function registerClient(input: unknown): Promise<OAuthResult> {
  if (typeof input !== "object" || input === null) {
    return oauthError(400, OAuthErrorCode.InvalidClientMetadata, "Body must be a JSON object");
  }
  const meta = input as Record<string, unknown>;

  const redirectUris = meta.redirect_uris;
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    redirectUris.length > 10 ||
    !redirectUris.every((u) => typeof u === "string" && isAllowedRedirectUri(u))
  ) {
    return oauthError(
      400,
      OAuthErrorCode.InvalidRedirectUri,
      "redirect_uris must be 1–10 https or loopback URLs"
    );
  }

  // Public (PKCE-only) unless the client asks for a secret.
  const method = meta.token_endpoint_auth_method ?? "none";
  if (
    method !== "none" &&
    method !== "client_secret_post" &&
    method !== "client_secret_basic"
  ) {
    return oauthError(
      400,
      OAuthErrorCode.InvalidClientMetadata,
      `Unsupported token_endpoint_auth_method: ${String(method)}`
    );
  }
  if (
    Array.isArray(meta.grant_types) &&
    !meta.grant_types.includes("authorization_code")
  ) {
    return oauthError(
      400,
      OAuthErrorCode.InvalidClientMetadata,
      "grant_types must include authorization_code"
    );
  }

  const name = clientNameOf(meta.client_name, "AI assistant");
  const secret = method === "none" ? null : newSecret();

  const client = await db.oAuthClient.create({
    data: {
      id: newSecret(),
      name,
      redirectUris: redirectUris as string[],
      secretHash: secret ? sha256(secret) : null,
    },
  });

  return {
    status: 201,
    body: {
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: name,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: method,
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    } satisfies OAuthClientInformationFull,
  };
}

// ─── Authorization ──────────────────────────────────────────────────────

type AuthorizeRequest = {
  client: OAuthClientInfo;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
};

type AuthorizeValidation =
  | { ok: true; request: AuthorizeRequest }
  // No trustworthy redirect — show the error on our own page.
  | { ok: false; message: string }
  // The redirect is verified, so the client hears about it the OAuth way.
  | { ok: false; redirectTo: string };

/** Build the redirect back to the client, with `iss` per RFC 9207. */
export function clientRedirect(
  redirectUri: string,
  issuer: string,
  params: Record<string, string | null>
): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v);
  }
  url.searchParams.set("iss", issuer);
  return url.toString();
}

export async function validateAuthorizeRequest(
  params: Record<string, string | undefined>,
  origin: string
): Promise<AuthorizeValidation> {
  const clientId = params.client_id;
  if (!clientId) return { ok: false, message: "This link is missing its client_id." };
  const client = await resolveClient(clientId);
  if (!client) {
    return { ok: false, message: "kcals doesn't recognise the app that sent you here." };
  }

  const redirectUri =
    params.redirect_uri ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : undefined);
  if (!redirectUri || !client.redirectUris.some((r) => redirectUriMatches(r, redirectUri))) {
    return { ok: false, message: "The app asked to send you somewhere it never registered." };
  }

  const state = params.state ?? null;
  const reject = (error: OAuthErrorCode, error_description: string): AuthorizeValidation => ({
    ok: false,
    redirectTo: clientRedirect(redirectUri, origin, { error, error_description, state }),
  });

  if (params.response_type !== "code") {
    return reject(OAuthErrorCode.UnsupportedResponseType, "Only response_type=code is supported");
  }
  if (!params.code_challenge || params.code_challenge_method !== "S256") {
    return reject(OAuthErrorCode.InvalidRequest, "PKCE with code_challenge_method=S256 is required");
  }

  // RFC 8707: a token is only ever for this server's MCP endpoint.
  const resource = params.resource?.replace(/\/+$/, "");
  if (resource && resource !== mcpResourceUrl(origin) && resource !== origin) {
    return reject(OAuthErrorCode.InvalidTarget, "Unknown resource");
  }

  return {
    ok: true,
    request: { client, redirectUri, state, codeChallenge: params.code_challenge },
  };
}

/** Mint the one-time code for an approved request; returns the client redirect. */
export async function issueAuthorizationCode(
  userId: string,
  request: AuthorizeRequest,
  issuer: string
): Promise<string> {
  const code = newSecret();
  await db.$transaction([
    // Opportunistic sweep — codes live minutes, nothing else cleans them.
    db.oAuthCode.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } }),
    db.oAuthCode.create({
      data: {
        codeHash: sha256(code),
        userId,
        clientId: request.client.id,
        clientName: request.client.name,
        redirectUri: request.redirectUri,
        codeChallenge: request.codeChallenge,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    }),
  ]);
  return clientRedirect(request.redirectUri, issuer, { code, state: request.state });
}

// ─── Token endpoint ─────────────────────────────────────────────────────

/** Client credentials from HTTP Basic, if that's how they were sent. */
export function basicClientCredentials(
  header: string | null
): { id: string; secret: string } | null {
  if (!header?.toLowerCase().startsWith("basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const i = decoded.indexOf(":");
    if (i < 0) return null;
    return {
      id: decodeURIComponent(decoded.slice(0, i)),
      secret: decodeURIComponent(decoded.slice(i + 1)),
    };
  } catch {
    return null;
  }
}

// A confidential client must prove its secret; a public one needs nothing
// beyond PKCE (on the code) or possession (of the refresh token).
async function authenticateClient(
  clientId: string,
  secret: string | null
): Promise<boolean> {
  if (isMetadataDocumentClient(clientId)) return true; // CIMD: always public
  const row = await db.oAuthClient.findUnique({
    where: { id: clientId },
    select: { secretHash: true },
  });
  if (!row) return false;
  if (!row.secretHash) return true;
  return secret != null && safeEqual(sha256(secret), row.secretHash);
}

function newTokenPair() {
  const accessToken = newSecret();
  const refreshToken = newSecret();
  const now = Date.now();
  return {
    accessToken,
    refreshToken,
    columns: {
      accessTokenHash: sha256(accessToken),
      accessExpiresAt: new Date(now + ACCESS_TTL_S * 1000),
      refreshTokenHash: sha256(refreshToken),
      refreshExpiresAt: new Date(now + REFRESH_TTL_MS),
      lastUsedAt: new Date(now),
    },
  };
}

function tokenResponse(pair: ReturnType<typeof newTokenPair>): OAuthResult {
  return {
    status: 200,
    body: {
      access_token: pair.accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_S,
      refresh_token: pair.refreshToken,
      scope: OAUTH_SCOPE,
    } satisfies OAuthTokens,
  };
}

export async function exchangeToken(
  form: URLSearchParams,
  basic: { id: string; secret: string } | null
): Promise<OAuthResult> {
  const clientId = basic?.id ?? form.get("client_id");
  const clientSecret = basic?.secret ?? form.get("client_secret");
  if (!clientId) return oauthError(401, OAuthErrorCode.InvalidClient, "client_id is required");
  if (!(await authenticateClient(clientId, clientSecret))) {
    return oauthError(401, OAuthErrorCode.InvalidClient, "Client authentication failed");
  }

  const grantType = form.get("grant_type");

  if (grantType === "authorization_code") {
    const code = form.get("code");
    const verifier = form.get("code_verifier");
    if (!code || !verifier) {
      return oauthError(400, OAuthErrorCode.InvalidRequest, "code and code_verifier are required");
    }
    const codeHash = sha256(code);
    const row = await db.oAuthCode.findUnique({ where: { codeHash } });
    // Burn it before anything else, so a code is good for one attempt even
    // when that attempt fails — and two racing redemptions can't both win.
    const { count } = await db.oAuthCode.deleteMany({ where: { codeHash } });
    if (!row || count === 0 || row.expiresAt < new Date()) {
      return oauthError(400, OAuthErrorCode.InvalidGrant, "Code is invalid or expired");
    }
    if (row.clientId !== clientId) {
      return oauthError(400, OAuthErrorCode.InvalidGrant, "Code was issued to another client");
    }
    const redirectUri = form.get("redirect_uri");
    if (redirectUri && redirectUri !== row.redirectUri) {
      return oauthError(400, OAuthErrorCode.InvalidGrant, "redirect_uri does not match");
    }
    if (!safeEqual(sha256(verifier), row.codeChallenge)) {
      return oauthError(400, OAuthErrorCode.InvalidGrant, "PKCE verification failed");
    }

    const pair = newTokenPair();
    await db.oAuthGrant.create({
      data: {
        userId: row.userId,
        clientId,
        clientName: row.clientName,
        ...pair.columns,
      },
    });
    return tokenResponse(pair);
  }

  if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token");
    if (!refreshToken) {
      return oauthError(400, OAuthErrorCode.InvalidRequest, "refresh_token is required");
    }
    const refreshTokenHash = sha256(refreshToken);
    const grant = await db.oAuthGrant.findUnique({
      where: { refreshTokenHash },
      select: { id: true, clientId: true, refreshExpiresAt: true },
    });
    if (!grant || grant.refreshExpiresAt < new Date() || grant.clientId !== clientId) {
      return oauthError(400, OAuthErrorCode.InvalidGrant, "Refresh token is invalid or expired");
    }
    // Rotate both tokens. Conditioning on the old hash makes a replayed or
    // raced refresh token lose instead of minting a second live pair.
    const pair = newTokenPair();
    const { count } = await db.oAuthGrant.updateMany({
      where: { id: grant.id, refreshTokenHash },
      data: pair.columns,
    });
    if (count === 0) {
      return oauthError(400, OAuthErrorCode.InvalidGrant, "Refresh token is invalid or expired");
    }
    return tokenResponse(pair);
  }

  return oauthError(400, OAuthErrorCode.UnsupportedGrantType, "Use authorization_code or refresh_token");
}

// ─── Resource server ────────────────────────────────────────────────────

/** The bearer's AuthInfo for /api/mcp, carrying the user it acts for. */
export async function verifyAccessToken(
  token: string
): Promise<AuthInfo | undefined> {
  const grant = await db.oAuthGrant.findUnique({
    where: { accessTokenHash: sha256(token) },
    select: { userId: true, clientId: true, accessExpiresAt: true },
  });
  if (!grant || grant.accessExpiresAt <= new Date()) return undefined;
  return {
    token,
    clientId: grant.clientId,
    scopes: [OAUTH_SCOPE],
    expiresAt: Math.floor(grant.accessExpiresAt.getTime() / 1000),
    // Read back by defineTool (lib/mcp/tool.ts) to act as this user.
    extra: { userId: grant.userId },
  };
}
