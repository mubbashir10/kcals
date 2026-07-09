// The latest published Android APK version. The in-app update banner
// (src/components/native/app-update.tsx) compares this against the installed
// build and prompts a one-tap download when it's higher.
//
// When publishing a new APK: bump `code` here AND `versionCode` in
// native/android/app/build.gradle to the same number, rebuild, and publish a
// GitHub release with the kcals.apk asset. `code` must be a monotonically
// increasing integer (matches Android's versionCode).
export const LATEST_ANDROID = { code: 9, name: "1.8" } as const;
