"use client";

import { useRef, useState, useTransition } from "react";
import {
  ChevronUp,
  Download,
  EyeOff,
  FileText,
  Minus,
  MoreHorizontal,
  Plus,
  Scale,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WidgetMenu } from "@/components/widget-menu";
import {
  displayWeight,
  formatWeightDelta,
  kgToLb,
  lbToKg,
  type Units,
} from "@/lib/bmr";
import { formatShortDateInTz } from "@/lib/clock";
import { round1 } from "@/lib/utils";
import { importWeightLogs, logWeight } from "@/app/actions/weight";
import { setWidgetState } from "@/app/actions/widgets";
import type { WidgetState } from "@/lib/widget-order";

export type WeightCardProps = {
  latest: { weightKg: number; loggedAt: string } | null;
  delta7dKg: number | null;
  units: Units;
  timezone: string;
  state: Exclude<WidgetState, "hidden">;
};

export function WeightCard({ latest, delta7dKg, units, timezone, state }: WeightCardProps) {
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [, startStateTransition] = useTransition();

  const display = latest ? displayWeight(latest.weightKg, units) : null;
  const deltaDisplay =
    delta7dKg != null
      ? (() => {
          const d = formatWeightDelta(delta7dKg, units);
          return { direction: d.direction, label: `${d.signed} · 7d` };
        })()
      : null;

  function changeState(next: WidgetState) {
    startStateTransition(async () => {
      await setWidgetState("weight", next);
    });
  }

  if (state === "minimized") {
    return (
      <Card className="group relative rounded-2xl border-border/60 px-5 py-3 shadow-card transition-colors hover:bg-accent/20">
        <AppLink
          href="/weight"
          aria-label="View weight history"
          className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Scale className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Weight
            </span>
          </div>
          <WidgetMenu
            widgetId="weight"
            current="minimized"
            label="Weight"
            size="sm"
          />
        </div>
        <div className="relative mt-1 flex items-baseline gap-2">
          {display ? (
            <>
              <span className="text-base font-semibold leading-none tabular-nums">
                {display.value}
                <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">
                  {display.unit}
                </span>
              </span>
              {deltaDisplay && deltaDisplay.direction !== "flat" && (
                <span
                  className={
                    "text-[11px] font-medium tabular-nums " +
                    (deltaDisplay.direction === "down"
                      ? "text-emerald-500"
                      : "text-rose-500")
                  }
                >
                  {deltaDisplay.label.replace(" · 7d", "")}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="group relative rounded-3xl border-border/60 p-6 shadow-card-lg transition-colors hover:bg-accent/20">
        <AppLink
          href="/weight"
          aria-label="View weight history"
          className="absolute inset-0 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Weight
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Weight options"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-expanded:bg-muted"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 rounded-xl p-1.5"
            >
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => setTimeout(() => setOpen(true), 0)}
                  className="cursor-pointer rounded-lg text-sm"
                >
                  <Plus className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Log weight
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => changeState("minimized")}
                  className="cursor-pointer rounded-lg text-sm"
                >
                  <ChevronUp className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Minimize
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => changeState("hidden")}
                  className="cursor-pointer rounded-lg text-sm"
                >
                  <EyeOff className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Hide
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => setTimeout(() => setImportOpen(true), 0)}
                  className="cursor-pointer rounded-lg text-sm"
                >
                  <Upload className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Import CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={
                    <a
                      href="/api/weight/export"
                      download
                      className="cursor-pointer rounded-lg text-sm"
                    />
                  }
                >
                  <Download className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Export CSV
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  render={
                    <a
                      href="/api/weight/template"
                      download
                      className="cursor-pointer rounded-lg text-sm"
                    />
                  }
                >
                  <FileText className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Download template
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {display ? (
          <>
            <div className="relative mt-3 flex items-baseline gap-3">
              <div className="text-3xl font-semibold leading-none tabular-nums tracking-tight">
                {display.value}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  {display.unit}
                </span>
              </div>
              {deltaDisplay && (
                <span
                  className={[
                    "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
                    deltaDisplay.direction === "down"
                      ? "text-emerald-500"
                      : deltaDisplay.direction === "up"
                      ? "text-rose-500"
                      : "text-muted-foreground",
                  ].join(" ")}
                >
                  {deltaDisplay.direction === "down" && (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {deltaDisplay.direction === "up" && (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  {deltaDisplay.direction === "flat" && (
                    <Minus className="h-3 w-3" />
                  )}
                  {deltaDisplay.label}
                </span>
              )}
            </div>
            <p className="relative mt-3 text-xs text-muted-foreground">
              {formatTimeAgo(latest!.loggedAt, timezone)}
              {delta7dKg == null && " · log again next week for trend"}
            </p>
          </>
        ) : (
          <div className="relative mt-3">
            <p className="text-sm text-foreground/80">No weigh-ins yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Track your weight daily to see trends.
            </p>
          </div>
        )}
      </Card>

      <LogWeightDialog
        open={open}
        onOpenChange={setOpen}
        units={units}
        initialKg={latest?.weightKg ?? null}
      />
      <WeightImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        defaultUnit={units === "imperial" ? "lb" : "kg"}
      />
    </>
  );
}

function LogWeightDialog({
  open,
  onOpenChange,
  units,
  initialKg,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: Units;
  initialKg: number | null;
}) {
  // Prefill with the user's most recent weight in their unit
  const initialDisplay =
    initialKg != null
      ? round1(units === "metric" ? initialKg : kgToLb(initialKg))
      : "";

  const [value, setValue] = useState(String(initialDisplay));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpen(next: boolean) {
    if (next) {
      setValue(String(initialDisplay));
      setError(null);
    }
    onOpenChange(next);
  }

  function onSave() {
    setError(null);
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num <= 0) {
      setError("Please enter a valid weight.");
      return;
    }
    const kg = units === "metric" ? num : lbToKg(num);
    if (kg < 30 || kg > 300) {
      setError("Please enter a weight between 30–300 kg (66–660 lb).");
      return;
    }
    startTransition(async () => {
      try {
        await logWeight(kg);
        onOpenChange(false);
      } catch {
        setError("Couldn't save. Try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogTitle className="text-base font-semibold">
          Log weight
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Quick daily weigh-in.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="weight-input"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Weight
            </Label>
            <div className="relative">
              <Input
                id="weight-input"
                autoFocus
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="pr-12 text-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSave();
                  }
                }}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">
                {units === "metric" ? "kg" : "lb"}
              </span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <DialogClose
              render={
                <Button variant="ghost" className="flex-1 rounded-full" />
              }
            >
              Cancel
            </DialogClose>
            <Button
              onClick={onSave}
              disabled={pending}
              className="flex-1 rounded-full"
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WeightImportDialog({
  open,
  onOpenChange,
  defaultUnit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultUnit: "kg" | "lb";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{
    rows: { date: string; weightKg: number }[];
    invalidCount: number;
    error: string | null;
  }>({ rows: [], invalidCount: 0, error: null });
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  function reset() {
    setFilename(null);
    setParsed({ rows: [], invalidCount: 0, error: null });
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onOpen(next: boolean) {
    if (next) reset();
    onOpenChange(next);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setResult(null);

    try {
      const text = await file.text();
      const { rows, invalidCount } = parseWeightCsv(text, defaultUnit);
      if (rows.length === 0 && invalidCount === 0) {
        setParsed({ rows: [], invalidCount: 0, error: "No rows found." });
      } else {
        setParsed({ rows, invalidCount, error: null });
      }
    } catch {
      setParsed({ rows: [], invalidCount: 0, error: "Couldn't read file." });
    }
  }

  function onImport() {
    if (parsed.rows.length === 0) return;
    startTransition(async () => {
      const res = await importWeightLogs(parsed.rows);
      setResult(res);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogTitle className="text-base font-semibold">
          Import weight CSV
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Columns: <code>date,weight,unit</code> · unit is optional (defaults
          to {defaultUnit}).
        </DialogDescription>

        <div className="mt-4 space-y-4">
          {!result && (
            <>
              <label
                htmlFor="weight-csv"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-4 py-8 text-center transition-colors hover:border-foreground/30 hover:bg-accent/40"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {filename ? filename : "Choose a .csv file"}
                </span>
                <span className="text-[11px] text-muted-foreground/70">
                  Get the format right with the template above.
                </span>
                <input
                  ref={inputRef}
                  id="weight-csv"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onFile}
                  className="hidden"
                />
              </label>

              {parsed.error && (
                <p className="text-xs text-destructive" role="alert">
                  {parsed.error}
                </p>
              )}

              {(parsed.rows.length > 0 || parsed.invalidCount > 0) && (
                <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {parsed.rows.length}
                  </span>{" "}
                  valid {parsed.rows.length === 1 ? "row" : "rows"}
                  {parsed.invalidCount > 0 &&
                    `, ${parsed.invalidCount} skipped`}
                  .
                </div>
              )}
            </>
          )}

          {result && (
            <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
              Imported {result.imported}{" "}
              {result.imported === 1 ? "entry" : "entries"}
              {result.skipped > 0 && ` · ${result.skipped} skipped`}.
            </div>
          )}

          <div className="flex gap-2">
            <DialogClose
              render={
                <Button variant="ghost" className="flex-1 rounded-full" />
              }
            >
              {result ? "Done" : "Cancel"}
            </DialogClose>
            {!result && (
              <Button
                onClick={onImport}
                disabled={parsed.rows.length === 0 || pending}
                className="flex-1 rounded-full"
              >
                {pending
                  ? "Importing…"
                  : `Import ${parsed.rows.length || ""}`.trim()}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Very small CSV parser. Accepts:
//   date,weight             (uses defaultUnit)
//   date,weight,unit        (unit per row: kg or lb)
// First row may be a header (auto-detected). Quotes are not supported,
// but we don't need them for this data shape.
function parseWeightCsv(
  text: string,
  defaultUnit: "kg" | "lb"
): { rows: { date: string; weightKg: number }[]; invalidCount: number } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length === 0) return { rows: [], invalidCount: 0 };

  // Detect header: any non-numeric in the weight column on the first row
  const first = lines[0].split(",").map((c) => c.trim());
  const headerLooksLikeHeader =
    first.length >= 2 &&
    (first[0].toLowerCase() === "date" ||
      isNaN(parseFloat(first[1])));

  const dataLines = headerLooksLikeHeader ? lines.slice(1) : lines;

  const rows: { date: string; weightKg: number }[] = [];
  let invalidCount = 0;

  for (const line of dataLines) {
    const cells = line.split(",").map((c) => c.trim());
    if (cells.length < 2) {
      invalidCount++;
      continue;
    }
    const date = cells[0];
    const weight = parseFloat(cells[1]);
    const unit = (cells[2]?.toLowerCase() === "lb"
      ? "lb"
      : cells[2]?.toLowerCase() === "kg"
      ? "kg"
      : defaultUnit) as "kg" | "lb";

    const parsedDate = new Date(date);
    if (
      isNaN(parsedDate.getTime()) ||
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      invalidCount++;
      continue;
    }
    const kg = unit === "lb" ? lbToKg(weight) : weight;
    rows.push({ date, weightKg: kg });
  }

  return { rows, invalidCount };
}

function formatTimeAgo(iso: string, tz: string) {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatShortDateInTz(date, tz);
}
