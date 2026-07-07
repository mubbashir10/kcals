import { signIn } from "@/auth";

// Entry point for native sign-in. The native bridge opens this URL in the
// SYSTEM browser (not the WebView) because Google refuses OAuth inside embedded
// WebViews. Here — in a real browser — we kick off the Google dance; on success
// next-auth redirects to /native/auth/finish, which hands the session back into
// the app. Runs on the Node runtime (the full auth config pulls in Prisma).
export const dynamic = "force-dynamic";

export async function GET() {
  // signIn throws a NEXT_REDIRECT to Google's authorization URL, which the
  // route handler propagates as a 3xx. redirectTo becomes the post-login
  // callback (validated same-origin by Auth.js).
  await signIn("google", { redirectTo: "/native/auth/finish" });
}
