"use client";

import { useEffect } from "react";

import { isNative } from "@/lib/native";

// TEMPORARY exploration probe: on native launch, ask for Health Connect read
// permission and collect what's actually in there — raw step records (each with
// its source app, so we can see Mi Fitness = com.xiaomi.wearable vs. others and
// any duplicates) plus the de-duped daily aggregates for steps and active
// calories. The result is POSTed to /api/native/hc-debug so we can read it in
// the server logs (release-build WebView console logs don't reach logcat).
// Remove this and the endpoint once we wire the real Settings-based sync.
export function HealthProbe() {
  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;

    (async () => {
      const report: Record<string, unknown> = {};
      const send = () =>
        fetch("/api/native/hc-debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report),
          keepalive: true,
        }).catch(() => {});

      try {
        const { Health } = await import("capacitor-health");

        const avail = await Health.isHealthAvailable();
        report.available = avail.available;
        if (cancelled || !avail.available) return void (await send());

        const req = await Health.requestHealthPermissions({
          permissions: ["READ_STEPS", "READ_ACTIVE_CALORIES"],
        });
        report.permissions = req.permissions;
        if (cancelled) return;

        const now = Date.now();
        const iso = (ms: number) => new Date(ms).toISOString();
        const day = 24 * 60 * 60 * 1000;

        // Raw step records over the last 3 days — each with its source.
        try {
          const recs = await Health.queryRecords({
            startDate: iso(now - 3 * day),
            endDate: iso(now),
            dataType: "steps",
          });
          report.stepRecords = recs.records;
        } catch (e) {
          report.stepRecordsError = e instanceof Error ? e.message : String(e);
        }

        // De-duped daily aggregates (what we'd feed TDEE).
        for (const dataType of ["steps", "active-calories"] as const) {
          try {
            const agg = await Health.queryAggregated({
              startDate: iso(now - 7 * day),
              endDate: iso(now),
              dataType,
              bucket: "day",
            });
            report[`aggregated_${dataType}`] = agg.aggregatedData;
          } catch (e) {
            report[`aggregated_${dataType}_error`] =
              e instanceof Error ? e.message : String(e);
          }
        }
      } catch (err) {
        report.error = err instanceof Error ? err.message : String(err);
      }

      if (!cancelled) await send();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
