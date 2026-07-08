"use client";

import { isNative } from "@/lib/native";
import { challengeFor, newVerifier, storeVerifier } from "@/lib/native-auth";

// The submit button for the Google sign-in form. On the web it does nothing
// special — the click submits the surrounding server-action form, which runs
// signIn("google") and redirects in-page. Inside the Capacitor shell that
// would land in the embedded WebView, which Google blocks, so we open the
// system browser at /native/auth/start instead. We first mint a PKCE-style
// verifier, keep it in this WebView, and pass only its hash (`ch`) out — so the
// session can only be redeemed back here (see src/lib/native-auth.ts).
export function GoogleSignInButton({
  redirectTo,
  children,
}: {
  redirectTo: string;
  children: React.ReactNode;
}) {
  const onClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isNative()) return;
    e.preventDefault();

    const verifier = newVerifier();
    storeVerifier(verifier);
    const params = new URLSearchParams({ ch: await challengeFor(verifier) });
    if (redirectTo && redirectTo !== "/") params.set("from", redirectTo);

    const { Browser } = await import("@capacitor/browser");
    await Browser.open({
      url: `${window.location.origin}/native/auth/start?${params.toString()}`,
    }).catch(() => {});
  };

  return (
    <button
      type="submit"
      onClick={onClick}
      className="group inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card text-sm font-medium text-foreground transition-all hover:border-foreground/20 hover:bg-accent/50 hover:shadow-card active:translate-y-px"
    >
      {children}
    </button>
  );
}
