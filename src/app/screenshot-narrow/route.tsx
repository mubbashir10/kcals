import { ImageResponse } from "next/og";

import { PromoFrame } from "@/lib/promo-frame";

// Portrait manifest screenshot (form_factor: "narrow"). Served at
// /screenshot-narrow. force-static so the (deterministic, expensive to
// rasterize) image is rendered once at build, not per request.
export const dynamic = "force-static";

const width = 1080;
const height = 1920;

export function GET() {
  return new ImageResponse(PromoFrame({ width, height }), { width, height });
}
