import Link from "next/link";
import type { ComponentProps } from "react";

type LinkProps = ComponentProps<typeof Link>;

interface AppLinkProps extends Omit<LinkProps, "prefetch" | "transitionTypes"> {
  /**
   * Direction the navigation moves in. Drives the slide animation
   * registered in globals.css:
   *   • forward — pushing deeper (home → add, settings → goal). Slides L.
   *   • back    — popping up. Slides R.
   *   • none    — disable directional animation, fall back to the layout's
   *               default crossfade. Use for tabs / same-route navigation.
   *
   * Defaults to "forward" since most links push deeper.
   */
  direction?: "forward" | "back" | "none";
  /**
   * Forces full RSC prefetch by default. All app pages are `force-dynamic`,
   * so Next's "auto" prefetch would only fetch down to a loading.tsx
   * boundary (we have none) — i.e. nothing useful. Setting `true` makes the
   * full route + data prefetch on viewport entry, which the service worker
   * then caches for instant repeat visits.
   *
   * Pass `false` for low-priority links (e.g. dropdown items not visible
   * on first paint) or for routes that shouldn't be eagerly hit.
   */
  prefetch?: boolean;
}

export function AppLink({
  direction = "forward",
  prefetch = true,
  ...props
}: AppLinkProps) {
  const transitionTypes =
    direction === "none"
      ? undefined
      : direction === "back"
        ? ["nav-back"]
        : ["nav-forward"];

  return (
    <Link {...props} prefetch={prefetch} transitionTypes={transitionTypes} />
  );
}
