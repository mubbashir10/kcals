import { ImageResponse } from "next/og";

import { FLAME_PATH } from "@/lib/brand";

// Apple touch icon — used on iOS when the user picks "Add to Home Screen".
// iOS adds its own rounded corners and applies a subtle gloss, so we
// render edge-to-edge without our own corner radius. Size is the standard
// 180×180 that iOS prefers.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
