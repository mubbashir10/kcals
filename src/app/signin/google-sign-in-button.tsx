"use client";

import { isNative } from "@/lib/native";

// The submit button for the Google sign-in form. On the web it does nothing
// special — the click submits the surrounding server-action form, which runs
// signIn("google") and redirects in-page. Inside the Capacitor shell that
// would land in the embedded WebView, which Google blocks, so we instead open
// the system browser at /native/auth/start; the native bridge deep-links the
// session back into the app on success.
export function GoogleSignInButton({
  children,
}: {
  children: React.ReactNode;
}) {
  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isNative()) return;
    e.preventDefault();
    import("@capacitor/browser")
      .then(({ Browser }) =>
        Browser.open({ url: `${window.location.origin}/native/auth/start` })
      )
      .catch(() => {});
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
