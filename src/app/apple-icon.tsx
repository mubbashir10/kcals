import { ImageResponse } from "next/og";

// Apple touch icon — used on iOS when the user picks "Add to Home Screen".
// iOS adds its own rounded corners and applies a subtle gloss, so we
// render edge-to-edge without our own corner radius. Size is the standard
// 180×180 that iOS prefers.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const FLAME_PATH =
  "M13.5 2.7c.22 2.93 1.78 5.13 3.4 7.36 1.7 2.34 3.2 4.55 3.2 7.59 0 4.55-3.42 7.94-7.62 7.94S4.86 22.2 4.86 17.65c0-1.98.79-3.62 1.95-4.91.46.81 1.13 1.4 2.07 1.63-.55-1.87-.32-3.97.84-5.72 1.04-1.55 2.74-2.57 3.01-4.32.66.47 1.13 1.05 1.4 1.75.12-1.16.04-2.32-.63-3.38z";

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 30% 25%, #1f2937 0%, #0a0a0a 70%)",
        }}
      >
        <svg width={130} height={130} viewBox="0 0 26 26">
          <defs>
            <linearGradient
              id="g"
              x1="0"
              y1="0"
              x2="0"
              y2="26"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#A3E635" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>
          </defs>
          <path d={FLAME_PATH} fill="url(#g)" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
