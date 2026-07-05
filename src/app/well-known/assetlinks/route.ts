// Digital Asset Links — served at /.well-known/assetlinks.json via the
// rewrite in next.config.ts. This is what lets a self-distributed Android
// app (a Trusted Web Activity, e.g. one built from this PWA with PWABuilder)
// verify it owns kcals.app and therefore run full-screen with NO browser
// URL bar. Without a matching fingerprint here, the TWA still works but
// shows a Chrome address bar at the top — the "not a real app" tell.
//
// To wire it up after building the APK:
//   1. PWABuilder (or `bubblewrap fingerprint`) prints the signing key's
//      SHA-256 fingerprint, e.g. "AB:CD:EF:...:12".
//   2. Set these env vars (locally in .env.local and on Vercel):
//        ANDROID_CERT_SHA256   — the fingerprint(s), comma-separated
//        ANDROID_PACKAGE_NAME  — the app id you chose (default app.kcals.twa)
//   3. Redeploy. Chrome re-checks this file and drops the URL bar.
//
// Serving an empty fingerprint list before the APK exists is fine — the file
// is valid JSON and 200s; verification simply doesn't pass until it's set.

export const dynamic = "force-dynamic";

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME || "app.kcals.twa";
  const fingerprints = (process.env.ANDROID_CERT_SHA256 || "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      // Let Chrome/Android re-check within a day of a fingerprint change.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
