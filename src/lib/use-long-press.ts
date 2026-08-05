"use client";

import { useCallback, useEffect, useRef } from "react";

import { hapticTap } from "@/lib/native";

// Press-and-hold on a touch target, the way iOS and Android do it: hold still
// for a beat and the element latches (here: a food row enters selection mode),
// with a buzz to confirm. Spread the returned props onto the element.
//
// Touch and pen only — a mouse has the row's own menu (and its right-click) and
// shouldn't arm a hold just because someone rested a button down while reading.
const HOLD_MS = 450; // matches the platforms' own press-and-hold feel
const MOVE_SLOP_PX = 10; // past this the finger is scrolling, not holding

/** Buttons and links inside the pressed element own their own gestures. */
function onOwnControl(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest("a, button, input");
}

export function useLongPress(
  onLongPress: () => void,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const timer = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0 });
  // True from the moment the hold fires until the click it generates has been
  // swallowed — lifting a finger always emits one.
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Don't leave a pending hold behind if the row unmounts mid-press.
  useEffect(() => cancel, [cancel]);

  return {
    onPointerDown(e: React.PointerEvent) {
      // Clear any stale flag first: a hold that fired and was then dragged off
      // never produces its click, and the next tap must not eat the suppression.
      fired.current = false;
      cancel();
      if (!enabled || e.pointerType === "mouse" || onOwnControl(e.target)) return;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        fired.current = true;
        hapticTap("medium");
        onLongPress();
      }, HOLD_MS);
    },
    onPointerMove(e: React.PointerEvent) {
      if (timer.current === null) return;
      const moved = Math.hypot(
        e.clientX - start.current.x,
        e.clientY - start.current.y
      );
      if (moved > MOVE_SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // The hold already did the work — swallow the click the lift generates, or
    // the row would also run its tap action and undo what the hold just did.
    onClickCapture(e: React.MouseEvent) {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    // Android raises this mid-hold to offer text selection. Only swallow it
    // while a hold of ours is in flight, so a real right-click stays untouched.
    onContextMenu(e: React.MouseEvent) {
      if (timer.current !== null || fired.current) e.preventDefault();
    },
  };
}
