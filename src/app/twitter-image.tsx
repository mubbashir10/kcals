// Twitter card image — re-uses the OpenGraph image renderer so we keep
// a single visual source of truth. The route-segment config must be
// statically inlined per Next 16 / Turbopack rules; only the default
// export can be re-used.
import Image from "./opengraph-image";

export const runtime = "edge";
export const alt =
  "kcals — a beautifully simple calorie tracker. Track meals, hit your goals, share progress with friends.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default Image;
