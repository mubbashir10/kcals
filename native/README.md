# kcals — native Android app (Capacitor)

This folder is the **real native Android app** for kcals. It replaces the old
TWA (`~/Desktop/kcals-android/`, a Chrome-in-a-frame shell) with a proper
Capacitor app that has a native bridge.

Everything here is self-contained and git-tracked with the web app; nothing in
`src/` needs Capacitor to build for the web.

## How it works (architecture)

kcals is a full-stack Next.js app (server components, server actions, next-auth
middleware, per-request Prisma) — it **can't be statically exported**. So this
app runs in **remote-URL mode**:

- `capacitor.config.ts` sets `server.url = https://kcals.app`. The native
  WebView loads the **live production site**, so app content auto-updates on
  every Vercel deploy — you rarely rebuild this shell.
- On top of the WebView we add native plugins: splash, status bar, hardware
  back button, keyboard, haptics, share, network/offline, external-link
  handling, deep links, and push. All of this is wired from the web side in
  [`src/components/native/native-bridge.tsx`](../src/components/native/native-bridge.tsx),
  guarded so it no-ops for web/PWA users.

### Google sign-in (the tricky part)

Google **blocks OAuth inside embedded WebViews**, and a Capacitor WebView is
one. So native sign-in bounces out to the system browser and hands the session
back via a one-time code:

1. Tap **Continue with Google** → the bridge opens the **system browser** at
   `/native/auth/start` (not the WebView).
2. `/native/auth/start` runs `signIn("google")` → real Google OAuth (allowed in
   a real browser) → back to `/native/auth/finish`.
3. `/native/auth/finish` mints a single-use code (`NativeAuthCode`, 60s TTL) and
   deep-links `kcals://auth-callback?code=…` into the app.
4. The bridge catches the deep link (`@capacitor/app` `appUrlOpen`), closes the
   browser, and loads `/native/auth/consume?code=…` **inside the WebView**.
5. `/native/auth/consume` burns the code and mints the same JWT session cookie
   Auth.js would — now the WebView is signed in, same-origin, everything works.

This reuses the existing web Google OAuth client untouched. **No new Google
Cloud config is needed** (Google never sees the `kcals://` link — it's our own
post-login redirect).

## Prerequisites

None of these are installed by `pnpm install` — you need them to **build/run**
the app (the scaffolding and all code already exist):

1. **Android Studio** — https://developer.android.com/studio. It bundles the
   Android SDK and a JDK. After install, open it once to let it download the
   SDK, then set:
   ```sh
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$ANDROID_HOME/platform-tools:$PATH"
   ```
2. **Firebase project** (only for push notifications) — see [Push](#push-notifications-fcm).

## Everyday workflow

From this `native/` folder:

```sh
# After changing capacitor.config.ts, installing a plugin, or editing android/:
npx cap sync android

# Open the project in Android Studio (build / run / sign from there):
npx cap open android

# …or run straight onto a connected device / running emulator:
npx cap run android
```

You do **not** need to rebuild when the web app changes — `server.url` points at
production, so a Vercel deploy updates the app instantly. Rebuild the shell only
when you change native config, plugins, icons, or the manifest.

## Push notifications (FCM)

The code path is done (`src/lib/push.ts`, `/api/push/register`, and a friend-
invite-accepted trigger). To turn it on you need Firebase:

1. Firebase Console → create a project (or reuse one).
2. **Add app → Android**, package name **`app.kcals`**.
3. Download **`google-services.json`** → place at
   `native/android/app/google-services.json` (gitignored). The Gradle wiring is
   already conditional on this file existing, so no Gradle edits are needed.
4. Project settings → **Service accounts → Generate new private key**. Put the
   full JSON on one line into the **`FIREBASE_SERVICE_ACCOUNT`** env var (Vercel
   prod, and `.env.local` for local testing). Without it, `sendPush()` no-ops.
5. `npx cap sync android`, rebuild.

Notifications carry a `data.url`; tapping one deep-links to that in-app path.

> Note: a signed-out phone keeps its device token until someone signs in
> again. In practice the token re-points to the new user on their next login
> (the `/api/push/register` upsert is keyed by token), and dead tokens are
> pruned when FCM rejects them, so this self-heals. Fine for a family app.

## Building a signed release APK

The app id is **`app.kcals`** — a *different* id than the old TWA
(`app.kcals.twa`), so both can coexist; uninstall the old TWA on family phones.

**Easiest:** `npx cap open android`, then Android Studio →
**Build → Generate Signed Bundle / APK → APK**. Create (or reuse) a keystore
when prompted, pick `release`, and it produces
`android/app/release/app-release.apk`.

**CLI:** create a keystore once (keytool ships with the JDK), then build:

```sh
# 1. Create a signing keystore (keep it safe + backed up — a differently-signed
#    APK can't update an installed one).
keytool -genkey -v -keystore kcals-release.keystore \
  -alias kcals -keyalg RSA -keysize 2048 -validity 10000

# 2. Reference it in android/keystore.properties (gitignored) and configure the
#    release signingConfig in android/app/build.gradle, then:
cd android && ./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

Share the APK file directly (no Play Store). Bump `versionCode`/`versionName`
in `android/app/build.gradle` for each update you distribute.

## Files

- `capacitor.config.ts` — app id, remote `server.url`, splash & push config.
- `www/index.html` — offline/first-load fallback (unused while online).
- `android/` — the native project (committed; build output is gitignored).
- `android/app/src/main/AndroidManifest.xml` — customized with the `kcals://`
  deep-link intent filter (auth handoff) and `POST_NOTIFICATIONS` permission.
