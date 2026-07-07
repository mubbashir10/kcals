import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getSiteUrl } from "@/lib/site";

// Reached in the system browser right after Google OAuth succeeds (see
// /native/auth/start). The browser now holds a session cookie, but that's the
// browser's cookie jar — not the app's WebView. So we mint a short-lived,
// single-use code, stash it, and deep-link back into the app with it; the app
// exchanges it at /native/auth/consume to establish its own session.
export const dynamic = "force-dynamic";

const CODE_TTL_MS = 60_000; // 60s — just long enough to bounce back into the app.

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    // The browser isn't signed in (shouldn't happen post-OAuth) — restart.
    return NextResponse.redirect(`${getSiteUrl()}/signin`);
  }

  const code = randomBytes(32).toString("base64url");
  await db.nativeAuthCode.create({
    data: {
      code,
      userId: session.user.id,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  // Opportunistic prune so expired codes can't accumulate (delete-on-consume
  // handles the happy path; this sweeps abandoned flows).
  db.nativeAuthCode
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});

  // base64url is [A-Za-z0-9-_] only, so it's safe to interpolate into both the
  // href and the JS string below without further escaping.
  const deepLink = `kcals://auth-callback?code=${code}`;

  // Auto-hand back to the app, with a manual button in case the browser blocks
  // the automatic app-scheme launch (some browsers require a tap).
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Returning to kcals…</title>
    <style>
      html,body{height:100%;margin:0;background:#0a0a0a;color:#e5e5e5;font-family:system-ui,-apple-system,sans-serif}
      .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;text-align:center;padding:2rem}
      .brand{font-size:2rem;font-weight:600;letter-spacing:-.02em;background:linear-gradient(to bottom,#a3e635,#10b981);-webkit-background-clip:text;background-clip:text;color:transparent}
      p{opacity:.6;font-size:.9rem;max-width:20rem;line-height:1.5}
      .btn{display:inline-block;padding:.7rem 1.4rem;border-radius:999px;background:#10b981;color:#04120c;font-weight:600;text-decoration:none}
    </style>
    <script>window.location.replace(${JSON.stringify(deepLink)});</script>
  </head>
  <body>
    <div class="wrap">
      <div class="brand">kcals</div>
      <p>Signed in! Returning to the app…</p>
      <a class="btn" href="${deepLink}">Open kcals</a>
    </div>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
