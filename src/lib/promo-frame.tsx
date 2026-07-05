import type { ReactElement } from "react";

import { FLAME_PATH } from "@/lib/brand";

// Shared artwork for the PWA manifest `screenshots` — rendered by the
// /screenshot-narrow and /screenshot-wide routes via next/og. Manifest
// screenshots unlock Android's richer install dialog (a proper app card with
// preview instead of a bare "Add to home screen" chip). This is a branded
// promo frame — a mock of the calorie dashboard on the brand gradient —
// rather than a live capture, so it stays in sync without a screenshot step.

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "18px 28px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <span style={{ fontSize: 30, fontWeight: 600, color: "#f5f5f5" }}>
        {value}
      </span>
      <span style={{ fontSize: 20, color: "#8b8b8b" }}>{label}</span>
    </div>
  );
}

export function PromoFrame({
  width,
  height,
}: {
  width: number;
  height: number;
}): ReactElement {
  const ring = Math.min(width, height) * 0.42;
  const stroke = ring * 0.11;
  const r = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // ~68% of the goal consumed.
  const dash = circumference * 0.68;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 56,
        background:
          "radial-gradient(circle at 50% 18%, #10361f 0%, #0a0a0a 60%)",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg width={64} height={64} viewBox="0 0 26 26">
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="0" y2="26">
              <stop offset="0" stopColor="#A3E635" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>
          </defs>
          <path d={FLAME_PATH} fill="url(#lg)" />
        </svg>
        <span style={{ fontSize: 52, fontWeight: 700, color: "#fafafa" }}>
          kcals
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          width: ring,
          height: ring,
        }}
      >
        <svg width={ring} height={ring} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={ring / 2}
            cy={ring / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={stroke}
          />
          <circle
            cx={ring / 2}
            cy={ring / 2}
            r={r}
            fill="none"
            stroke="#10B981"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: ring * 0.2, fontWeight: 700, color: "#fafafa" }}>
            1,847
          </span>
          <span style={{ fontSize: ring * 0.07, color: "#8b8b8b" }}>
            kcal left
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        <Chip label="Protein" value="128g" />
        <Chip label="Carbs" value="164g" />
        <Chip label="Fat" value="52g" />
      </div>

      <span style={{ fontSize: 28, color: "#a3a3a3", marginTop: 12 }}>
        Track meals. Hit your goals.
      </span>
    </div>
  );
}
