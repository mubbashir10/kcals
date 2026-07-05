import { ImageResponse } from "next/og";

import { FLAME_PATH } from "@/lib/brand";
import { getSiteHost } from "@/lib/site";

// Next.js metadata-file conventions:
// https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image
export const runtime = "edge";
export const alt =
  "kcals — a beautifully simple calorie tracker. Track meals, hit your goals, share progress with friends.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#fafaf7",
          backgroundImage: [
            "radial-gradient(55% 55% at 18% 0%, rgba(252, 211, 77, 0.55) 0%, rgba(252, 211, 77, 0) 65%)",
            "radial-gradient(48% 48% at 85% 8%, rgba(132, 230, 60, 0.5) 0%, rgba(132, 230, 60, 0) 65%)",
            "radial-gradient(60% 60% at 90% 100%, rgba(16, 185, 129, 0.18) 0%, rgba(16, 185, 129, 0) 70%)",
          ].join(", "),
          position: "relative",
        }}
      >
        {/* Logo + wordmark, centered */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <svg width={120} height={120} viewBox="0 0 26 26">
            <defs>
              <linearGradient
                id="flameGradient"
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
            <path d={FLAME_PATH} fill="url(#flameGradient)" />
          </svg>

          <div
            style={{
              fontSize: 140,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              background: "linear-gradient(180deg, #A3E635 0%, #10B981 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            kcals
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 36,
            fontSize: 36,
            fontWeight: 500,
            color: "#1f2937",
            textAlign: "center",
            maxWidth: 900,
            letterSpacing: "-0.01em",
            lineHeight: 1.25,
          }}
        >
          A beautifully simple calorie tracker.
        </div>

        {/* Feature line */}
        <div
          style={{
            marginTop: 18,
            fontSize: 24,
            color: "#6b7280",
            textAlign: "center",
            maxWidth: 920,
            lineHeight: 1.4,
          }}
        >
          Track meals · hit your goals · share progress with friends
        </div>

        {/* Domain badge in bottom-right corner */}
        <div
          style={{
            position: "absolute",
            right: 56,
            bottom: 48,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 18,
            color: "#10b981",
            fontWeight: 600,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          {getSiteHost()}
        </div>
      </div>
    ),
    { ...size }
  );
}
