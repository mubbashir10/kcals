"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function TimezonePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (tz: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const zones = useMemo(() => {
    type WithSupportedValuesOf = {
      supportedValuesOf?: (k: "timeZone") => string[];
    };
    const intlAny = Intl as unknown as WithSupportedValuesOf;
    const list = intlAny.supportedValuesOf?.("timeZone") ?? [];
    // Ensure the current value is in the list even if the runtime doesn't list it.
    if (value && !list.includes(value)) return [value, ...list];
    return list;
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter((z) => z.toLowerCase().includes(q));
  }, [zones, query]);

  function pick(tz: string) {
    onChange(tz);
    setOpen(false);
    setQuery("");
  }

  const offsetLabel = useMemo(() => formatTzOffset(value), [value]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate">{value || "Select timezone"}</span>
          {offsetLabel && (
            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
              {offsetLabel}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl p-0 sm:max-w-sm">
          <div className="px-4 pt-4">
            <DialogTitle className="text-base font-semibold">
              Choose timezone
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              We&rsquo;ll use this clock for everything time-related.
            </DialogDescription>
          </div>

          <div className="px-4 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ul className="max-h-[60vh] overflow-y-auto px-2 pb-3 pt-2">
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                No matches.
              </li>
            )}
            {filtered.map((tz) => {
              const selected = tz === value;
              return (
                <li key={tz}>
                  <button
                    type="button"
                    onClick={() => pick(tz)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60",
                      selected && "bg-accent/40"
                    )}
                  >
                    <span className="truncate">{tz}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {formatTzOffset(tz)}
                      </span>
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatTzOffset(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    return name ?? "";
  } catch {
    return "";
  }
}
