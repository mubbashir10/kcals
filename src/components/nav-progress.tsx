"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Thin, Linear-style top progress bar shown while a navigation is in flight.
//
// Triggered by AppLink dispatching a `kcals:nav-start` event on click;
// cancelled by the pathname/search-params actually changing (route commit).
//
//   • 100ms grace before showing — instant navigations (cache hit, prefetched
//     RSC) finish well under that and stay silent.
//   • Indeterminate animation that creeps from 0 → 90% during the wait, then
//     snaps to 100% on commit before fading out. Matches Linear / GitHub.
const SHOW_DELAY_MS = 100;
const HIDE_DELAY_MS = 180;

type Phase = "hidden" | "loading" | "finishing";

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("hidden");

  // Track the route signature so the commit-detection effect only fires on
  // *actual* navigations, not on first mount.
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const lastRouteKey = useRef(routeKey);

  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for the click that starts a navigation.
  useEffect(() => {
    function onStart() {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (showTimer.current) clearTimeout(showTimer.current);
      // Defer the actual paint so cached/prefetched routes never flash.
      showTimer.current = setTimeout(() => setPhase("loading"), SHOW_DELAY_MS);
    }
    window.addEventListener("kcals:nav-start", onStart);
    return () => window.removeEventListener("kcals:nav-start", onStart);
  }, []);

  // Detect commit via pathname/search change.
  useEffect(() => {
    if (routeKey === lastRouteKey.current) return;
    lastRouteKey.current = routeKey;

    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }

    // If we never escalated to "loading" the bar was never visible — just
    // stay hidden. Otherwise snap to 100% then fade out.
    setPhase((p) => (p === "loading" ? "finishing" : "hidden"));

    hideTimer.current = setTimeout(() => setPhase("hidden"), HIDE_DELAY_MS);
  }, [routeKey]);

  useEffect(() => {
    return () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      // Fixed above everything (the sticky headers have z-10). Pointer events
      // off so it never blocks clicks on the underlying header.
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] overflow-hidden"
    >
      <div
        className={
          "h-full bg-gradient-to-r from-lime-400 to-emerald-500 " +
          (phase === "loading"
            ? "animate-[nav-progress-creep_8s_ease-out_forwards]"
            : "w-full opacity-0 transition-opacity duration-150")
        }
      />
    </div>
  );
}
