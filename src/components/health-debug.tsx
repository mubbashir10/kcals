"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readHealthDebug, type HealthDebug } from "@/lib/health";

// Formats an ISO instant as device-local HH:MM (this runs on-device, so local
// time is what the user is comparing against Mi Fitness / Google Fit).
function hm(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// Collapsible "what does Health Connect actually hold" panel. Shows the
// de-duped totals kcals uses plus the raw per-source step records, so you can
// see whether a stale number is the tracker's fault (old writes) or kcals'.
export function HealthDebugPanel() {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<HealthDebug | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      setData(await readHealthDebug());
    });

  // Auto-run once on mount so the panel is foolproof — just scroll to it.
  useEffect(() => {
    let alive = true;
    startTransition(async () => {
      const d = await readHealthDebug();
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && !data) run();
        }}
        className="flex w-full items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Stethoscope className="h-3.5 w-3.5" />
        Diagnostics
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <Button
            type="button"
            onClick={run}
            disabled={pending}
            variant="secondary"
            size="sm"
            className="rounded-full"
          >
            {pending ? "Reading…" : "Read Health Connect"}
          </Button>

          {data && (
            <div className="rounded-xl bg-muted/40 p-3 text-[11px] leading-relaxed">
              <Row k="Native app" v={data.native ? "yes" : "NO"} hi />
              <Row k="Platform" v={data.platform} />
              <Row k="Capacitor global" v={data.capacitorGlobal} hi />
              <Row k="SW controlling" v={data.swActive ? "yes" : "no"} />
              <Row k="App version" v={data.appVersion} hi />
              <Row k="Permission" v={data.permission ? "granted" : "denied"} />
              <Row k="Available" v={data.available ? "yes" : "no"} />
              <Row
                k="Window"
                v={`${hm(data.windowStart)}–${hm(data.readAt)} · ${data.tz}`}
              />
              <Row
                k="Steps (de-duped)"
                v={data.aggSteps?.toLocaleString() ?? "—"}
              />
              <Row
                k="Active kcal"
                v={data.aggActiveKcal?.toLocaleString() ?? "—"}
              />
              <Row
                k="Latest step data"
                v={data.latestRecordEnd ? hm(data.latestRecordEnd) : "none today"}
                hi
              />
              <Row
                k="Sources"
                v={data.sources.length ? data.sources.join(", ") : "—"}
              />
              <Row k="Raw records" v={String(data.recordCount)} />
              {data.error && <Row k="Error" v={data.error} />}
              {data.ua && (
                <div className="mt-2 break-all border-t border-border/60 pt-2 text-[10px] leading-relaxed text-muted-foreground/70">
                  UA: {data.ua}
                </div>
              )}

              {data.records.length > 0 && (
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto border-t border-border/60 pt-2">
                  {data.records.slice(0, 40).map((r, i) => (
                    <div
                      key={i}
                      className="flex items-baseline justify-between gap-2 tabular-nums text-muted-foreground"
                    >
                      <span className="truncate text-foreground/70">
                        {hm(r.start)}–{hm(r.end)}
                        {r.manual && " · manual"}
                      </span>
                      <span className="shrink-0">
                        {r.value.toLocaleString()} · {r.source}
                      </span>
                    </div>
                  ))}
                  {data.records.length > 40 && (
                    <div className="text-muted-foreground/60">
                      +{(data.records.length - 40).toLocaleString()} more…
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, hi }: { k: string; v: string; hi?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
      <span className="shrink-0">{k}</span>
      <span
        className={cn(
          "truncate text-right tabular-nums",
          hi ? "font-semibold text-foreground" : "text-foreground/70"
        )}
      >
        {v}
      </span>
    </div>
  );
}
