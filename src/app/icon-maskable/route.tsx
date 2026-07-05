import { ImageResponse } from "next/og";

import { FLAME_PATH } from "@/lib/brand";

// Maskable 512×512 PWA icon — served at /icon-maskable and referenced from
// the manifest with purpose:"maskable". Android masks installed-app icons to
// a circle / squircle / teardrop depending on the launcher, clipping the
// outer ~10–20% of the image. So unlike /icon (which fills most of the
// frame), the flame here sits well inside the safe zone (~50% of the canvas)
// over a full-bleed gradient — nothing important reaches the edges, so it
// stays intact under any mask and the splash screen looks native.
export const dynamic = "force-static";

export function GET() {
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
        <svg width={260} height={260} viewBox="0 0 26 26">
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
    { width: 512, height: 512 }
  );
}
