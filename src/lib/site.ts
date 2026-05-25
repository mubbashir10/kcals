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

export function getSiteHost(): string {
  try {
    return new URL(getSiteUrl()).host;
  } catch {
    return "localhost:3000";
  }
}
