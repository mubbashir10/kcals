import { ImageResponse } from "next/og";

import { PromoFrame } from "@/lib/promo-frame";

// Landscape manifest screenshot (form_factor: "wide"). Served at
// /screenshot-wide. Required alongside a narrow one for Chrome's richer
// install UI on larger screens. force-static so it's rendered once at build.
export const dynamic = "force-static";

const width = 1920;
const height = 1080;

export function GET() {
  return new ImageResponse(PromoFrame({ width, height }), { width, height });
}
