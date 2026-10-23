// Single source of truth for the app's public URL. Everything that needs
// to render an absolute link, social-card host, OG metadataBase, or invite
// URL goes through here — never hardcode the domain elsewhere.
//
// Resolution order:
//   1. NEXT_PUBLIC_APP_URL          — explicit override (set in .env.local
//                                     for dev, on Vercel for prod custom domain)
//   2. VERCEL_PROJECT_PRODUCTION_URL — auto-set by Vercel when no override
//   3. http://localhost:3000        — last-resort dev default
//
// All return values are normalized to NOT have a trailing slash.

function normalize(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return normalize(explicit);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${normalize(vercel)}`;

  return "http://localhost:3000";
}

/**
 * The origin this request actually reached us on, from the proxy's forwarded
 * headers. Use it instead of getSiteUrl() only where the URL must match the
 * host the client is talking to — the OAuth documents for MCP, whose issuer
 * and resource URLs clients check against each other — so production,
 * previews and localhost each describe themselves.
 */
export function getRequestOrigin(headers: Headers): string {
  const host =
    headers.get("x-forwarded-host")?.split(",")[0].trim() || headers.get("host");
  if (!host) return getSiteUrl();
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export function getSiteHost(): string {
  try {
    return new URL(getSiteUrl()).host;
  } catch {
    return "localhost:3000";
  }
}
