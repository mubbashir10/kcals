"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Copy,
  CornerUpRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, round1 } from "@/lib/utils";
import {
  dayKeyInTz,
  formatTimeInTz,
  setTimeOnDateInTz,
  timeInputValueInTz,
} from "@/lib/clock";
import {
  updateMeal,
  deleteMeal,
  moveMeal,
  copyMeal,
  listMealsOnDay,
} from "@/app/actions/meals";

// Derived from the server action's return type — the action file is
// "use server" and can't export the type itself.
type MealOption = Awaited<ReturnType<typeof listMealsOnDay>>[number];
import {
  deleteFood,
  updateFoodGrams,
  updateFoodQuickAdd,
  moveFood,
  copyFood,
} from "@/app/actions/foods";

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
  const [transferMode, setTransferMode] = useState<"move" | "copy" | null>(null);
  const [editingFood, setEditingFood] = useState<MealCardFood | null>(null);
  const [transferFood, setTransferFood] = useState<{
    mode: "move" | "copy";
    food: MealCardFood;
  } | null>(null);

  const mealKcal = meal.foods.reduce((a, f) => a + f.kcal, 0);
  const mealProtein = meal.foods.reduce((a, f) => a + f.proteinG, 0);
  const mealCarbs = meal.foods.reduce((a, f) => a + f.carbsG, 0);
  const mealFat = meal.foods.reduce((a, f) => a + f.fatG, 0);
  const time = formatTimeInTz(meal.loggedAt, timezone);
  // Carry the meal's own day so "Add food" lands on the right date (and the
  // add flow redirects back here), not whatever "today" is.
  const addHref = `/add?meal=${meal.id}&day=${dayKeyInTz(
    timezone,
    new Date(meal.loggedAt)
  )}`;

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 p-0 shadow-none">
      <header className="border-b border-border/60 bg-muted/30 px-5 py-3">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setRenameOpen(true)}
            className="group min-w-0 flex-1 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <h3 className="truncate text-sm font-semibold tracking-tight transition-colors group-hover:text-foreground/70">
              {meal.name ?? "Meal"}
            </h3>
            <time className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
              {time}
            </time>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Meal options"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-expanded:bg-muted"
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
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg text-sm"
                  onClick={() => setTransferMode("move")}
                >
                  <CornerUpRight className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Move to…
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg text-sm"
                  onClick={() => setTransferMode("copy")}
                >
                  <Copy className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Copy to…
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  className="cursor-pointer rounded-lg text-sm"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">
              {Math.round(mealKcal)}
            </span>{" "}
            kcal
          </span>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <span>
            P <span className="font-medium text-foreground/80">{Math.round(mealProtein)}</span>
          </span>
          <span>
            C <span className="font-medium text-foreground/80">{Math.round(mealCarbs)}</span>
          </span>
          <span>
            F <span className="font-medium text-foreground/80">{Math.round(mealFat)}</span>
          </span>
        </div>
      </header>

      {meal.foods.length === 0 && (
        <div className="px-5 py-8 text-center">
          <p className="mb-3 text-xs text-muted-foreground">No food yet</p>
          <AppLink
            href={addHref}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-full bg-foreground px-4 text-xs font-medium text-background transition-opacity hover:opacity-90"
          >
            <Plus className="h-3 w-3" />
            Add food
          </AppLink>
        </div>
      )}

      <ul className="divide-y divide-border/60">
        {meal.foods.map((f) => (
          <FoodRow
            key={f.id}
            food={f}
            onEdit={() => setEditingFood(f)}
            onMove={() => setTransferFood({ mode: "move", food: f })}
            onCopy={() => setTransferFood({ mode: "copy", food: f })}
          />
        ))}
      </ul>

      {meal.foods.length > 0 && (
        <AppLink
          href={addHref}
          className="flex items-center justify-center gap-1.5 border-t border-border/60 px-5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add food
        </AppLink>
      )}

      <EditMealDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        meal={meal}
        timezone={timezone}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        meal={meal}
      />
      <TransferMealDialog
        mode={transferMode}
        onClose={() => setTransferMode(null)}
        meal={meal}
        timezone={timezone}
      />
      <FoodEditDialog
        food={editingFood}
        onClose={() => setEditingFood(null)}
      />
      <FoodTransferDialog
        transfer={transferFood}
        currentMealId={meal.id}
        currentDayKey={dayKeyInTz(timezone, new Date(meal.loggedAt))}
        timezone={timezone}
        onClose={() => setTransferFood(null)}
      />
    </Card>
  );
}

function FoodRow({
  food: f,
  onEdit,
  onMove,
  onCopy,
}: {
  food: MealCardFood;
  onEdit: () => void;
  onMove: () => void;
  onCopy: () => void;
}) {
  const [deletePending, startDelete] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    startDelete(async () => {
      await deleteFood(f.id);
    });
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
          "group flex cursor-pointer items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-accent/40",
          deletePending && "opacity-50"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] leading-tight">{f.name}</div>
          {(f.brand || f.grams > 0) && (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {f.brand ? f.brand : null}
              {f.brand && f.grams > 0 ? " · " : null}
              {f.grams > 0 ? `${round1(f.grams)} g` : null}
            </div>
          )}
        </div>

        <div className="shrink-0 text-right tabular-nums">
          <span className="text-[13px] font-semibold">
            {Math.round(f.kcal)}
          </span>
          <span className="ml-1 text-[10px] text-muted-foreground">kcal</span>
        </div>

        <div className="flex items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Food options"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-expanded:bg-muted"
            >
              <MoreHorizontal className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl p-1.5">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg text-sm"
                  onClick={onEdit}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg text-sm"
                  onClick={onMove}
                >
                  <CornerUpRight className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Move to…
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg text-sm"
                  onClick={onCopy}
                >
                  <Copy className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Copy to…
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deletePending}
            aria-label="Delete food"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/15 disabled:pointer-events-none"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </li>
  );
}

function EditMealDialog({
  open,
  onOpenChange,
  meal,
  timezone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealCardData;
  timezone: string;
}) {
  const [name, setName] = useState(meal.name ?? "");
  const [time, setTime] = useState(() =>
    timeInputValueInTz(meal.loggedAt, timezone)
  );
  const [pending, startTransition] = useTransition();

  // reset to current meal values whenever the dialog opens
  function onOpen(next: boolean) {
    if (next) {
      setName(meal.name ?? "");
      setTime(timeInputValueInTz(meal.loggedAt, timezone));
    }
    onOpenChange(next);
  }

  function onSave() {
    startTransition(async () => {
      const original = timeInputValueInTz(meal.loggedAt, timezone);
      const loggedAt =
        time && time !== original
          ? setTimeOnDateInTz(meal.loggedAt, timezone, time)
          : undefined;
      await updateMeal(meal.id, { name, loggedAt });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogTitle className="text-base font-semibold">Edit meal</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Leave the name empty to use the default label.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="meal-name"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
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

          <div className="space-y-2">
            <Label
              htmlFor="meal-time"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Time
            </Label>
            <Input
              id="meal-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="tabular-nums"
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

function TransferMealDialog({
  mode,
  onClose,
  meal,
  timezone,
}: {
  mode: "move" | "copy" | null;
  onClose: () => void;
  meal: MealCardData;
  timezone: string;
}) {
  return (
    <Dialog open={mode !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        {mode && (
          <TransferMealForm
            key={mode}
            mode={mode}
            meal={meal}
            timezone={timezone}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransferMealForm({
  mode,
  meal,
  timezone,
  onClose,
}: {
  mode: "move" | "copy";
  meal: MealCardData;
  timezone: string;
  onClose: () => void;
}) {
  const [date, setDate] = useState(() => dayKeyInTz(timezone, new Date(meal.loggedAt)));
  const [time, setTime] = useState(() => timeInputValueInTz(meal.loggedAt, timezone));
  const [pending, startTransition] = useTransition();

  // Can't log into the future — clamp the date picker to today.
  const todayKey = dayKeyInTz(timezone, new Date());
  const dateValid = !!date && date <= todayKey;
  const isCopy = mode === "copy";
  const label = meal.name ?? "Meal";
  const submitLabel = pending
    ? isCopy
      ? "Copying…"
      : "Moving…"
    : isCopy
      ? "Copy"
      : "Move";

  function onSubmit() {
    if (!dateValid) return;
    startTransition(async () => {
      if (isCopy) await copyMeal(meal.id, date, time);
      else await moveMeal(meal.id, date, time);
      onClose();
    });
  }

  return (
    <>
      <DialogTitle className="text-base font-semibold">
        {isCopy ? "Copy meal" : "Move meal"}
      </DialogTitle>
      <DialogDescription className="text-xs text-muted-foreground">
        {isCopy
          ? `Duplicate “${label}” and its food to another day and time.`
          : `Move “${label}” to another day and time.`}
      </DialogDescription>

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label
              htmlFor="transfer-date"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Date
            </Label>
            <Input
              id="transfer-date"
              type="date"
              value={date}
              max={todayKey}
              onChange={(e) => setDate(e.target.value)}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="transfer-time"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Time
            </Label>
            <Input
              id="transfer-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="tabular-nums"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <DialogClose
            render={<Button variant="ghost" className="flex-1 rounded-full" />}
          >
            Cancel
          </DialogClose>
          <Button
            onClick={onSubmit}
            disabled={pending || !dateValid}
            className="flex-1 rounded-full"
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </>
  );
}

function FoodTransferDialog({
  transfer,
  currentMealId,
  currentDayKey,
  timezone,
  onClose,
}: {
  transfer: { mode: "move" | "copy"; food: MealCardFood } | null;
  currentMealId: number;
  currentDayKey: string;
  timezone: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={transfer !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        {transfer && (
          <FoodTransferForm
            key={`${transfer.mode}-${transfer.food.id}`}
            mode={transfer.mode}
            food={transfer.food}
            currentMealId={currentMealId}
            currentDayKey={currentDayKey}
            timezone={timezone}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FoodTransferForm({
  mode,
  food,
  currentMealId,
  currentDayKey,
  timezone,
  onClose,
}: {
  mode: "move" | "copy";
  food: MealCardFood;
  currentMealId: number;
  currentDayKey: string;
  timezone: string;
  onClose: () => void;
}) {
  const [date, setDate] = useState(currentDayKey);
  const [meals, setMeals] = useState<MealOption[] | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const todayKey = dayKeyInTz(timezone, new Date());
  const isCopy = mode === "copy";
  const submitLabel = pending
    ? isCopy
      ? "Copying…"
      : "Moving…"
    : isCopy
      ? "Copy"
      : "Move";

  // Load the chosen day's meals to pick a destination. Re-runs when the date
  // changes; the cancelled flag drops a stale response if the user flips dates
  // quickly. The "loading" reset lives in changeDate (the event handler) so we
  // don't call setState synchronously inside the effect.
  useEffect(() => {
    let cancelled = false;
    listMealsOnDay(date).then((list) => {
      if (!cancelled) setMeals(list);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  function changeDate(next: string) {
    setMeals(null);
    setSelectedMealId(null);
    setDate(next);
  }

  // Moving into the food's own meal is a no-op, so it can't be a target.
  function isDisabled(mealId: number) {
    return !isCopy && mealId === currentMealId;
  }

  function onSubmit() {
    if (selectedMealId == null) return;
    startTransition(async () => {
      if (isCopy) await copyFood(food.id, selectedMealId);
      else await moveFood(food.id, selectedMealId);
      onClose();
    });
  }

  return (
    <>
      <DialogTitle className="text-base font-semibold">
        {isCopy ? "Copy food" : "Move food"}
      </DialogTitle>
      <DialogDescription className="text-xs text-muted-foreground">
        {isCopy ? "Duplicate" : "Move"} “{food.name}” into another meal.
      </DialogDescription>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="food-transfer-date"
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
          >
            Day
          </Label>
          <Input
            id="food-transfer-date"
            type="date"
            value={date}
            max={todayKey}
            onChange={(e) => changeDate(e.target.value)}
            className="tabular-nums"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Meal
          </Label>
          {meals === null ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              Loading…
            </p>
          ) : meals.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
              No meals on this day. Pick another day.
            </p>
          ) : (
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {meals.map((m) => {
                const disabled = isDisabled(m.id);
                const selected = m.id === selectedMealId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedMealId(m.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                      selected
                        ? "border-foreground/40 bg-accent/40"
                        : "border-border/60 hover:bg-accent/30",
                      disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {m.name ?? "Meal"}
                        {disabled && (
                          <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                            (current)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {formatTimeInTz(m.loggedAt, timezone)} · {m.kcal} kcal ·{" "}
                        {m.foodCount} {m.foodCount === 1 ? "food" : "foods"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <DialogClose
            render={<Button variant="ghost" className="flex-1 rounded-full" />}
          >
            Cancel
          </DialogClose>
          <Button
            onClick={onSubmit}
            disabled={pending || selectedMealId == null}
            className="flex-1 rounded-full"
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </>
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
          {meal.foods.length === 1 ? "" : "s"} inside it. Can&apos;t be undone.
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
  return (
    <Dialog open={!!food} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        {food && (
          <FoodEditForm key={food.id} food={food} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FoodEditForm({
  food,
  onClose,
}: {
  food: MealCardFood;
  onClose: () => void;
}) {
  const isQuickAdd = food.grams === 0;

  const [grams, setGrams] = useState<string>(() => String(round1(food.grams)));
  const [kcalInput, setKcalInput] = useState<string>(() =>
    String(Math.round(food.kcal))
  );
  const [proteinInput, setProteinInput] = useState<string>(() =>
    macroInitial(food.proteinG)
  );
  const [carbsInput, setCarbsInput] = useState<string>(() =>
    macroInitial(food.carbsG)
  );
  const [fatInput, setFatInput] = useState<string>(() =>
    macroInitial(food.fatG)
  );
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();

  // Branch 1: quick-add row — edit kcal + macros directly, no portion math.
  // Branch 2: scanned food — edit grams, derive kcal/macros from per-100g.
  const g = parseFloat(grams);
  const validGrams = Number.isFinite(g) && g > 0 && g < 5000;

  const kVal = parseFloat(kcalInput);
  const validKcal = Number.isFinite(kVal) && kVal > 0 && kVal < 10000;

  const valid = isQuickAdd ? validKcal : validGrams;

  // Per-100g basis — only meaningful when food has a real serving size.
  const per100g =
    food.grams > 0
      ? {
          kcal: (food.kcal / food.grams) * 100,
          proteinG: (food.proteinG / food.grams) * 100,
          carbsG: (food.carbsG / food.grams) * 100,
          fatG: (food.fatG / food.grams) * 100,
        }
      : null;

  const factor = validGrams ? g / 100 : 0;
  const computed = per100g
    ? {
        kcal: per100g.kcal * factor,
        proteinG: per100g.proteinG * factor,
        carbsG: per100g.carbsG * factor,
        fatG: per100g.fatG * factor,
      }
    : null;

  function onSave() {
    if (!valid) return;
    startSave(async () => {
      if (isQuickAdd) {
        await updateFoodQuickAdd(food.id, {
          kcal: round1(kVal),
          proteinG: parseMacro(proteinInput),
          carbsG: parseMacro(carbsInput),
          fatG: parseMacro(fatInput),
        });
      } else {
        await updateFoodGrams(food.id, round1(g));
      }
      onClose();
    });
  }

  function onDelete() {
    startDelete(async () => {
      await deleteFood(food.id);
      onClose();
    });
  }

  return (
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
        {isQuickAdd ? (
          <>
            <div className="space-y-2">
              <Label
                htmlFor="edit-kcal"
                className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                Calories
              </Label>
              <div className="relative">
                <Input
                  id="edit-kcal"
                  inputMode="numeric"
                  autoFocus
                  value={kcalInput}
                  onChange={(e) => setKcalInput(e.target.value)}
                  className="pr-14 text-lg"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && valid) {
                      e.preventDefault();
                      onSave();
                    }
                  }}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">
                  kcal
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Macros
                <span className="ml-1 normal-case tracking-normal text-muted-foreground/60">
                  (optional)
                </span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <MacroEditInput
                  id="edit-protein"
                  label="P"
                  value={proteinInput}
                  onChange={setProteinInput}
                />
                <MacroEditInput
                  id="edit-carbs"
                  label="C"
                  value={carbsInput}
                  onChange={setCarbsInput}
                />
                <MacroEditInput
                  id="edit-fat"
                  label="F"
                  value={fatInput}
                  onChange={setFatInput}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label
                htmlFor="edit-grams"
                className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
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
          </>
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
            disabled={!valid || savePending || deletePending}
            className="rounded-full"
          >
            {savePending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </>
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
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

// Show the existing macro value when editing a quick-add row, but leave the
// field blank if it's zero so the placeholder ("0") guides the user.
function macroInitial(g: number): string {
  return g > 0 ? String(round1(g)) : "";
}

function parseMacro(s: string): number {
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return round1(Math.min(n, 1000));
}

function MacroEditInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="pl-7 pr-8 tabular-nums"
      />
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
        g
      </span>
    </div>
  );
}
