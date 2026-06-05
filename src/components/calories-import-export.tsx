"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FileText, MoreHorizontal, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { parseCaloriesCsv, type CaloriesCsvRow } from "@/lib/calories-csv";
import {
  importCalorieDays,
  previewCalorieImport,
} from "@/app/actions/calories";

type Preview = Awaited<ReturnType<typeof previewCalorieImport>>;

export function CaloriesImportExport() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Calorie data options"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-expanded:bg-muted"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
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
                  href="/api/calories/export"
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
                  href="/api/calories/template"
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

      <CaloriesImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}

function CaloriesImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [rows, setRows] = useState<CaloriesCsvRow[]>([]);
  // Lines the parser dropped (bad date, non-positive kcal). Combined with the
  // server's invalid count (future-dated / duplicate-day rows) for the total.
  const [parseInvalid, setParseInvalid] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, startPreview] = useTransition();
  const [pending, startImport] = useTransition();
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  function reset() {
    setFilename(null);
    setRows([]);
    setParseInvalid(0);
    setError(null);
    setPreview(null);
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
    setPreview(null);
    setError(null);

    let parsedRows: CaloriesCsvRow[];
    let invalidCount: number;
    try {
      const text = await file.text();
      ({ rows: parsedRows, invalidCount } = parseCaloriesCsv(text));
    } catch {
      setRows([]);
      setParseInvalid(0);
      setError("Couldn't read file.");
      return;
    }

    if (parsedRows.length === 0 && invalidCount === 0) {
      setRows([]);
      setParseInvalid(0);
      setError("No rows found.");
      return;
    }

    setRows(parsedRows);
    setParseInvalid(invalidCount);

    if (parsedRows.length === 0) {
      // Everything was malformed — nothing to classify server-side.
      setPreview({ importable: 0, existing: 0, invalid: 0, existingDays: [] });
      return;
    }
    startPreview(async () => {
      setPreview(await previewCalorieImport(parsedRows));
    });
  }

  function onImport() {
    if (rows.length === 0) return;
    startImport(async () => {
      setResult(await importCalorieDays(rows));
    });
  }

  const invalidTotal = (preview?.invalid ?? 0) + parseInvalid;
  const canImport = (preview?.importable ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogTitle className="text-base font-semibold">
          Import calories CSV
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Columns: <code>date,kcal,protein_g,carbs_g,fat_g</code> · macros are
          optional. One row per day. Days that already have logged food are
          skipped.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          {!result && (
            <>
              <label
                htmlFor="calories-csv"
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
                  id="calories-csv"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onFile}
                  className="hidden"
                />
              </label>

              {error && (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}

              {previewing && (
                <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Checking days…
                </div>
              )}

              {preview && !previewing && (
                <div className="space-y-1.5 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                  <div>
                    <span className="font-semibold text-foreground">
                      {preview.importable}
                    </span>{" "}
                    {preview.importable === 1 ? "day" : "days"} to import
                  </div>
                  {preview.existing > 0 && (
                    <div>
                      <span className="font-semibold text-foreground">
                        {preview.existing}
                      </span>{" "}
                      skipped — already have entries
                      {preview.existingDays.length > 0 && (
                        <span className="text-muted-foreground/70">
                          {" "}
                          ({preview.existingDays.join(", ")}
                          {preview.existing > preview.existingDays.length
                            ? ", …"
                            : ""}
                          )
                        </span>
                      )}
                    </div>
                  )}
                  {invalidTotal > 0 && (
                    <div>
                      <span className="font-semibold text-foreground">
                        {invalidTotal}
                      </span>{" "}
                      invalid {invalidTotal === 1 ? "row" : "rows"}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {result && (
            <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
              Imported {result.imported}{" "}
              {result.imported === 1 ? "day" : "days"}
              {result.skipped > 0 && ` · ${result.skipped} skipped`}.
            </div>
          )}

          <div className="flex gap-2">
            <DialogClose
              render={<Button variant="ghost" className="flex-1 rounded-full" />}
            >
              {result ? "Done" : "Cancel"}
            </DialogClose>
            {!result && (
              <Button
                onClick={onImport}
                disabled={!canImport || previewing || pending}
                className="flex-1 rounded-full"
              >
                {pending
                  ? "Importing…"
                  : `Import ${preview?.importable || ""}`.trim()}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
