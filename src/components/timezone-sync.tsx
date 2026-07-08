"use client";

import { useEffect } from "react";

import { syncTimezone } from "@/app/actions/widgets";

// Keeps the user's stored timezone tracking the device clock, so every "today"
// in kcals matches the phone (and Health Connect / Mi Fitness). Runs once per
// app load; the action no-ops when signed out or already correct, so there's
// no manual timezone setting to get wrong.
export function TimezoneSync() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) void syncTimezone(tz);
    } catch {
      // Intl unavailable — leave the stored tz as-is.
    }
  }, []);

  return null;
}
