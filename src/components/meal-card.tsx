"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatTimeInTz } from "@/lib/clock";
import { renameMeal, deleteMeal } from "@/app/actions/meals";
import { deleteFood, updateFoodGrams } from "@/app/actions/foods";

export type MealCardFood = {
  id: number;
  name: string;
  brand: string | null;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type MealCardData = {
  id: number;
  name: string | null;
  loggedAt: Date | string;
  foods: MealCardFood[];
};

export function MealCard({
  meal,
  timezone,
}: {
  meal: MealCardData;
  timezone: string;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<MealCardFood | null>(null);

  const mealKcal = meal.foods.reduce((a, f) => a + f.kcal, 0);
  const time = formatTimeInTz(meal.loggedAt, timezone);

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 p-0 shadow-none">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-5 py-3">
        <button
          type="button"
          onClick={() => setRenameOpen(true)}
          className="group flex min-w-0 items-baseline gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <h3 className="truncate text-sm font-semibold tracking-tight transition-colors group-hover:text-foreground/70">
            {meal.name ?? "Meal"}
          </h3>
          <time className="text-xs text-muted-foreground tabular-nums">
            {time}
          </time>
          <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
        </button>

        <div className="flex items-center gap-3">
          <div className="text-xs tabular-nums text-muted-foreground">
            <span className="font-semibold text-foreground">
              {Math.round(mealKcal)}
            </span>{" "}
            kcal
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Meal options"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-expanded:bg-muted"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl p-1.5">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg text-sm"
                  onClick={() => setRenameOpen(true)}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg text-sm text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {meal.foods.length === 0 && (
        <div className="px-5 py-8 text-center">
          <p className="mb-3 text-xs text-muted-foreground">No food yet</p>
          <Link
            href={`/add?meal=${meal.id}`}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-full bg-foreground px-4 text-xs font-medium text-background transition-opacity hover:opacity-90"
          >
            <Plus className="h-3 w-3" />
            Add food
          </Link>
        </div>
      )}

      <ul className="divide-y divide-border/60">
        {meal.foods.map((f) => (
          <FoodRow
            key={f.id}
            food={f}
            onEdit={() => setEditingFood(f)}
          />
        ))}
      </ul>

      {meal.foods.length > 0 && (
        <Link
          href={`/add?meal=${meal.id}`}
          className="flex items-center justify-center gap-1.5 border-t border-border/60 px-5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add food
        </Link>
      )}

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        meal={meal}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        meal={meal}
      />
      <FoodEditDialog
        food={editingFood}
        onClose={() => setEditingFood(null)}
      />
    </Card>
  );
}

function FoodRow({
  food: f,
  onEdit,
}: {
  food: MealCardFood;
  onEdit: () => void;
}) {
  const [deletePending, startDelete] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    startDelete(async () => {
      await deleteFood(f.id);
    });
  }

  function handleEditClick(e: React.MouseEvent) {
    e.stopPropagation();
    onEdit();
  }

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
          deletePending && "opacity-50"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{f.name}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {f.brand ? `${f.brand} · ` : ""}
            {round1(f.grams)} g
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={handleEditClick}
            aria-label="Edit food"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deletePending}
            aria-label="Delete food"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive disabled:pointer-events-none"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        <div className="min-w-[44px] text-right">
          <div className="text-base font-semibold tabular-nums">
            {Math.round(f.kcal)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            kcal
          </div>
        </div>
      </div>
    </li>
  );
}

function RenameDialog({
  open,
  onOpenChange,
  meal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealCardData;
}) {
  const [name, setName] = useState(meal.name ?? "");
  const [pending, startTransition] = useTransition();

  // reset to current meal name whenever the dialog opens
  function onOpen(next: boolean) {
    if (next) setName(meal.name ?? "");
    onOpenChange(next);
  }

  function onSave() {
    startTransition(async () => {
      await renameMeal(meal.id, name);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogTitle className="text-base font-semibold">
          Rename meal
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Leave empty to use the default label.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="meal-name"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Name
            </Label>
            <Input
              id="meal-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Breakfast"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSave();
                }
              }}
            />
          </div>

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

function DeleteDialog({
  open,
  onOpenChange,
  meal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealCardData;
}) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      await deleteMeal(meal.id);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogTitle className="text-base font-semibold">
          Delete this meal?
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          This removes the meal and all {meal.foods.length} food
          {meal.foods.length === 1 ? "" : "s"} inside it. Can't be undone.
        </DialogDescription>

        <div className="mt-4 flex gap-2">
          <DialogClose
            render={<Button variant="ghost" className="flex-1 rounded-full" />}
          >
            Cancel
          </DialogClose>
          <Button
            onClick={onDelete}
            disabled={pending}
            variant="destructive"
            className="flex-1 rounded-full"
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FoodEditDialog({
  food,
  onClose,
}: {
  food: MealCardFood | null;
  onClose: () => void;
}) {
  const [grams, setGrams] = useState<string>("");
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();

  // reset grams whenever a new food opens
  useEffect(() => {
    if (food) setGrams(String(round1(food.grams)));
  }, [food]);

  const g = parseFloat(grams);
  const valid = Number.isFinite(g) && g > 0 && g < 5000;

  // Derive per-100g from what's stored so we can live-recompute.
  const per100g = food
    ? {
        kcal: (food.kcal / food.grams) * 100,
        proteinG: (food.proteinG / food.grams) * 100,
        carbsG: (food.carbsG / food.grams) * 100,
        fatG: (food.fatG / food.grams) * 100,
      }
    : null;

  const factor = valid ? g / 100 : 0;
  const computed = per100g
    ? {
        kcal: per100g.kcal * factor,
        proteinG: per100g.proteinG * factor,
        carbsG: per100g.carbsG * factor,
        fatG: per100g.fatG * factor,
      }
    : null;

  function onSave() {
    if (!food || !valid) return;
    startSave(async () => {
      await updateFoodGrams(food.id, round1(g));
      onClose();
    });
  }

  function onDelete() {
    if (!food) return;
    startDelete(async () => {
      await deleteFood(food.id);
      onClose();
    });
  }

  return (
    <Dialog open={!!food} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        {food && (
          <>
            <DialogTitle className="pr-6 text-base font-semibold leading-tight">
              {food.name}
            </DialogTitle>
            {food.brand && (
              <DialogDescription className="text-xs text-muted-foreground">
                {food.brand}
              </DialogDescription>
            )}

            <div className="mt-4 space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="edit-grams"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Serving
                </Label>
                <div className="relative">
                  <Input
                    id="edit-grams"
                    inputMode="decimal"
                    autoFocus
                    value={grams}
                    onChange={(e) => setGrams(e.target.value)}
                    className="pr-12 text-lg"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">
                    g
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 rounded-xl bg-muted/40 p-3">
                <FoodStat
                  label="kcal"
                  value={computed ? Math.round(computed.kcal) : 0}
                  emphasis
                />
                <FoodStat
                  label="P"
                  value={computed ? round1(computed.proteinG) : 0}
                  unit="g"
                />
                <FoodStat
                  label="C"
                  value={computed ? round1(computed.carbsG) : 0}
                  unit="g"
                />
                <FoodStat
                  label="F"
                  value={computed ? round1(computed.fatG) : 0}
                  unit="g"
                />
              </div>

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
                  render={
                    <Button variant="ghost" className="rounded-full" />
                  }
                >
                  Cancel
                </DialogClose>
                <Button
                  onClick={onSave}
                  disabled={!valid || savePending || deletePending}
                  className="rounded-full"
                >
                  {savePending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FoodStat({
  label,
  value,
  unit,
  emphasis,
}: {
  label: string;
  value: number;
  unit?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={
          emphasis
            ? "text-xl font-semibold tabular-nums tracking-tight"
            : "text-base font-medium tabular-nums tracking-tight"
        }
      >
        {value}
        {unit && (
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
