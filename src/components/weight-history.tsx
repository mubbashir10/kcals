"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, round1 } from "@/lib/utils";
import {
  kgToLb,
  lbToKg,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
  type Units,
} from "@/lib/bmr";
import { nudgeMeasurementSync } from "@/lib/native";
import { formatRelativeDateInTz, formatTimeInTz } from "@/lib/clock";
import {
  deleteWeightLog,
  updateWeightLog,
} from "@/app/actions/weight";

export type WeightHistoryEntry = {
  id: number;
  weightKg: number;
  loggedAt: string;
};

export function WeightHistory({
  entries,
  units,
  timezone,
}: {
  entries: WeightHistoryEntry[];
  units: Units;
  timezone: string;
}) {
  const [editing, setEditing] = useState<WeightHistoryEntry | null>(null);

  if (entries.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-10 text-center shadow-none">
        <p className="text-sm text-muted-foreground">No weigh-ins yet.</p>
      </Card>
    );
  }

  // Compute change vs previous entry (sorted descending by date,
  // so "previous" is the next item in the array)
  const deltas = entries.map((e, i) => {
    const next = entries[i + 1];
    return next ? e.weightKg - next.weightKg : null;
  });

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border-border/60 p-0 shadow-card">
        <ul className="divide-y divide-border/60">
          {entries.map((entry, i) => (
            <WeightHistoryRow
              key={entry.id}
              entry={entry}
              delta={deltas[i]}
              units={units}
              timezone={timezone}
              onEdit={() => setEditing(entry)}
            />
          ))}
        </ul>
      </Card>

      <EditWeightDialog
        entry={editing}
        units={units}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function WeightHistoryRow({
  entry,
  delta,
  units,
  timezone,
  onEdit,
}: {
  entry: WeightHistoryEntry;
  delta: number | null;
  units: Units;
  timezone: string;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await deleteWeightLog(entry.id);
      nudgeMeasurementSync();
    });
  }

  const value = units === "imperial" ? kgToLb(entry.weightKg) : entry.weightKg;
  const unit = units === "imperial" ? "lb" : "kg";
  const dateStr = formatRelativeDateInTz(new Date(entry.loggedAt), timezone);
  const timeStr = formatTimeInTz(entry.loggedAt, timezone);

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit();
          }
        }}
        className={cn(
          "group flex cursor-pointer items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent/40",
          pending && "opacity-50"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{dateStr}</span>
            <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {timeStr}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums">
              {round1(value).toFixed(1)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {unit}
              </span>
            </div>
            {delta != null && Math.abs(delta) >= 0.05 && (
              <div
                className={cn(
                  "text-[10px] font-medium tabular-nums",
                  delta < 0 ? "text-accent-foreground" : "text-destructive"
                )}
              >
                {delta < 0 ? "−" : "+"}
                {round1(
                  units === "imperial" ? Math.abs(kgToLb(delta)) : Math.abs(delta)
                ).toFixed(2)}{" "}
                {unit}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            aria-label="Delete entry"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function EditWeightDialog({
  entry,
  units,
  onClose,
}: {
  entry: WeightHistoryEntry | null;
  units: Units;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        {entry && (
          <EditWeightForm
            key={`${entry.id}:${units}`}
            entry={entry}
            units={units}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditWeightForm({
  entry,
  units,
  onClose,
}: {
  entry: WeightHistoryEntry;
  units: Units;
  onClose: () => void;
}) {
  const [value, setValue] = useState(() => {
    const v = units === "imperial" ? kgToLb(entry.weightKg) : entry.weightKg;
    return round1(v).toString();
  });
  const [error, setError] = useState<string | null>(null);
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();

  function onSave() {
    setError(null);
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num <= 0) {
      setError("Please enter a valid weight.");
      return;
    }
    const kg = units === "imperial" ? lbToKg(num) : num;
    if (kg < WEIGHT_MIN_KG || kg > WEIGHT_MAX_KG) {
      setError("Please enter a weight between 30–300 kg (66–660 lb).");
      return;
    }
    startSave(async () => {
      try {
        await updateWeightLog(entry.id, kg);
        nudgeMeasurementSync();
        onClose();
      } catch {
        setError("Couldn't save. Try again.");
      }
    });
  }

  function onDelete() {
    startDelete(async () => {
      await deleteWeightLog(entry.id);
      nudgeMeasurementSync();
      onClose();
    });
  }

  return (
    <>
      <DialogTitle className="text-base font-semibold">
        Edit weigh-in
      </DialogTitle>
      <DialogDescription className="text-xs text-muted-foreground">
        {new Date(entry.loggedAt).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </DialogDescription>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="edit-weight"
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
          >
            Weight
          </Label>
          <div className="relative">
            <Input
              id="edit-weight"
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

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={onDelete}
            disabled={deletePending || savePending}
            className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {deletePending ? "Deleting…" : "Delete"}
          </Button>
          <div className="flex-1" />
          <DialogClose
            render={<Button variant="ghost" className="rounded-full" />}
          >
            Cancel
          </DialogClose>
          <Button
            onClick={onSave}
            disabled={savePending || deletePending}
            className="rounded-full"
          >
            {savePending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}
