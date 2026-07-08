"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { isNative } from "@/lib/native";
import { hasHealthAccess, healthSyncEnabled, syncHealthNow } from "@/lib/health";

// Auto-syncs today's Health Connect activity into TDEE on native launch, when
// the user has enabled it in Settings. Silent; refreshes the view if anything
// changed. No-ops on web and when sync is off.
export function HealthSync() {
  const router = useRouter();
  useEffect(() => {
    if (!isNative() || !healthSyncEnabled()) return;
    let cancelled = false;
    (async () => {
      if (!(await hasHealthAccess())) return;
      const data = await syncHealthNow();
      if (!cancelled && data) router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
