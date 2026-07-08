"use client";

import { useEffect } from "react";

import { isNative } from "@/lib/native";

// TEMPORARY exploration probe: on native launch, ask for Health Connect read
// permission and dump what's actually in there — raw step records (each with
// its source app, so we can see Mi Fitness = com.xiaomi.wearable vs. others and
// any duplicates) plus the de-duped daily aggregates for steps and active
// calories. Everything is console.logged with an [HC] prefix so it surfaces in
// `adb logcat` (WebView console → logcat). Remove once we wire the real
// Settings-based sync.
export function HealthProbe() {
  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;

    (async () => {
      const tag = "[HC]";
      try {
        const { Health } = await import("capacitor-health");

        const avail = await Health.isHealthAvailable();
        console.log(tag, "available:", JSON.stringify(avail));
        if (cancelled || !avail.available) return;

        const perms = { permissions: ["READ_STEPS", "READ_ACTIVE_CALORIES"] as const };
        const req = await Health.requestHealthPermissions({
          permissions: perms.permissions.slice(),
        });
        console.log(tag, "permissions:", JSON.stringify(req));
        if (cancelled) return;

        const now = Date.now();
        const iso = (ms: number) => new Date(ms).toISOString();
        const day = 24 * 60 * 60 * 1000;

        // Raw step records over the last 3 days — shows each source separately.
        const records = await Health.queryRecords({
          startDate: iso(now - 3 * day),
          endDate: iso(now),
          dataType: "steps",
        });
        console.log(
          tag,
          "STEP RECORDS (3d):",
          records.records.length,
          "records"
        );
        for (const r of records.records) {
          console.log(
            tag,
            "  rec:",
            JSON.stringify({
              source: r.sourceName,
              bundle: r.sourceBundleId,
              value: r.value,
              start: r.startDate,
              end: r.endDate,
              manual: r.manual,
            })
          );
        }

        // De-duped daily aggregates (what we'd actually feed TDEE).
        for (const dataType of ["steps", "active-calories"] as const) {
          const agg = await Health.queryAggregated({
            startDate: iso(now - 7 * day),
            endDate: iso(now),
            dataType,
            bucket: "day",
          });
          console.log(tag, `AGGREGATED ${dataType} (daily, 7d):`);
          for (const s of agg.aggregatedData) {
            console.log(
              tag,
              "  day:",
              JSON.stringify({
                start: s.startDate,
                end: s.endDate,
                value: s.value,
              })
            );
          }
        }

        console.log(tag, "DONE");
      } catch (err) {
        console.log("[HC] ERROR:", err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
