"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { hapticTap } from "@/lib/native";

// Native-feeling pull-to-refresh for the whole app. Mounted once in the root
// layout, next to NavProgress.
//
// The browser's own pull-to-refresh is switched off in globals.css
// (overscroll-behavior-y: none) — it reloads the entire document, which in a
// Capacitor WebView means a cold boot and a white flash. This does the cheap
// thing instead: router.refresh(), which re-runs the Server Components and
// streams a new RSC payload while keeping client state and scroll position.
//
// router.refresh() returns void, so completion is tracked by running it inside
// a transition — isPending stays true until the payload lands. Both the
// setRefreshing(true) and the startTransition() below happen in the same event,
// so they batch into one commit and the "done" effect can never observe the
// gap before isPending flips true.
const THRESHOLD_PX = 72; // pull past this and release to refresh
const MAX_PULL_PX = 110; // the indicator stops following past here
const RESISTANCE = 0.5; // finger travel → indicator travel (rubber band)
const MIN_SPIN_MS = 450; // a refresh that lands instantly still reads as work
const MAX_SPIN_MS = 8000; // never strand the spinner if a refresh never settles

/** Don't hijack a gesture that belongs to something else on the page. */
function isBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    // A dnd-kit drag handle (Tailwind `touch-none`) or an opt-out.
    target.closest(".touch-none, [data-no-pull]") ||
      // Anything inside an overlay — the page behind it isn't what's scrolling.
      target.closest('[role="dialog"], [role="menu"], [role="listbox"]')
  );
}

/** True when some scroller between `target` and the body is already scrolled. */
function insideScrolledContainer(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    if (el.scrollTop > 0) {
      const overflowY = getComputedStyle(el).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") return true;
    }
    el = el.parentElement;
  }
  return false;
}

export function PullToRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Mirrors `engaged` for rendering: while the finger drives the indicator its
  // transform must not be transitioned, or it lags behind the touch.
  const [dragging, setDragging] = useState(false);

  // Gesture bookkeeping. Refs, not state — these change on every touchmove and
  // must not drive renders; only `pull` does.
  const startY = useRef(0);
  const startX = useRef(0);
  const tracking = useRef(false); // finger down, gesture still undecided
  const engaged = useRef(false); // committed to a pull, page scroll suppressed
  const armed = useRef(false); // pulled past the threshold at least once

  // The touch handlers are installed once and close over `refreshing`, so they
  // read it through a ref that a commit-time effect keeps current.
  const refreshingRef = useRef(false);
  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    const reset = () => {
      tracking.current = false;
      engaged.current = false;
      armed.current = false;
      setDragging(false);
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1) return;
      // Only from a document already scrolled to the very top.
      if (window.scrollY > 0) return;
      if (isBlocked(e.target) || insideScrolledContainer(e.target)) return;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      tracking.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking.current || refreshingRef.current) return;
      // Something downstream (a drag sensor) already claimed this gesture.
      if (e.defaultPrevented) return reset();

      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - startX.current;

      if (!engaged.current) {
        // Upward or sideways — this is a scroll or a swipe, not a pull.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) return reset();
        engaged.current = true;
        setDragging(true);
      }

      if (dy <= 0) {
        // Pulled back up past the origin: hand the gesture back to the page.
        setPull(0);
        return reset();
      }

      // preventDefault needs a non-passive listener (see addEventListener
      // below) and stops iOS from rubber-banding the document underneath us.
      e.preventDefault();
      const next = Math.min(dy * RESISTANCE, MAX_PULL_PX);
      setPull(next);

      if (next >= THRESHOLD_PX && !armed.current) {
        armed.current = true;
        hapticTap();
      } else if (next < THRESHOLD_PX) {
        armed.current = false;
      }
    };

    const onEnd = () => {
      if (!engaged.current || refreshingRef.current) return reset();
      const shouldRefresh = armed.current;
      reset();

      if (!shouldRefresh) {
        setPull(0);
        return;
      }
      // Park the indicator at the threshold while the payload streams in.
      setPull(THRESHOLD_PX);
      setRefreshing(true);
      startTransition(() => router.refresh());
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  // Retract once the transition settles — but never faster than MIN_SPIN_MS,
  // so a warm refresh doesn't flash the spinner for a single frame.
  useEffect(() => {
    if (!refreshing || isPending) return;
    const t = setTimeout(() => {
      setRefreshing(false);
      setPull(0);
    }, MIN_SPIN_MS);
    return () => clearTimeout(t);
  }, [refreshing, isPending]);

  // Backstop: a transition that never settles shouldn't strand the spinner.
  useEffect(() => {
    if (!refreshing) return;
    const t = setTimeout(() => {
      setRefreshing(false);
      setPull(0);
    }, MAX_SPIN_MS);
    return () => clearTimeout(t);
  }, [refreshing]);

  if (pull === 0 && !refreshing) return null;

  const progress = Math.min(pull / THRESHOLD_PX, 1);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div
        className={
          "mt-2 flex h-9 w-9 items-center justify-center rounded-full " +
          "border border-border/60 bg-background/80 shadow-lg backdrop-blur-xl " +
          (dragging ? "" : "transition-transform duration-300 ease-out")
        }
        style={{
          transform: `translateY(${pull}px)`,
          opacity: refreshing ? 1 : progress,
        }}
      >
        <RefreshCw
          className={
            "h-4 w-4 text-primary " + (refreshing ? "animate-spin" : "")
          }
          // Before release the icon winds up with the pull; during the refresh
          // `animate-spin` owns the rotation, so hand it over.
          style={refreshing ? undefined : { rotate: `${progress * 270}deg` }}
        />
      </div>
    </div>
  );
}
