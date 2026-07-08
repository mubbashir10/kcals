// Client-side helpers for the native OAuth handoff's PKCE-style binding.
//
// The WebView that starts sign-in generates a random verifier, keeps it in
// sessionStorage, and sends only its SHA-256 hash (the "challenge") out through
// the system browser. On the deep-link return it presents the verifier to
// /native/auth/consume, which mints a session only if it hashes to the stored
// challenge. So a code intercepted by a co-installed app (or a fixation code
// planted by an attacker) is worthless without the originating WebView's
// verifier.

const VERIFIER_KEY = "kcals.native-auth.verifier";

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Random 32-byte verifier (base64url). Never leaves the device. */
export function newVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** SHA-256(verifier) as base64url — the value that travels through the browser. */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return base64url(new Uint8Array(digest));
}

export function storeVerifier(verifier: string): void {
  try {
    sessionStorage.setItem(VERIFIER_KEY, verifier);
  } catch {
    // sessionStorage unavailable — sign-in will fail closed at /consume.
  }
}

/** Reads and clears the verifier (single-use). */
export function takeVerifier(): string {
  try {
    const v = sessionStorage.getItem(VERIFIER_KEY) ?? "";
    if (v) sessionStorage.removeItem(VERIFIER_KEY);
    return v;
  } catch {
    return "";
  }
}
