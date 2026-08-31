"use client";

import { useState, useTransition } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Check,
  EyeOff,
  MoreHorizontal,
  RotateCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
import { resetDay } from "@/app/actions/meals";
import { setWidgetState, setMealSort } from "@/app/actions/widgets";
import type { MealSortDir, WidgetId } from "@/lib/widget-order";

/** What "Reset day" would throw away — shown in the confirmation. */
type ResetDayTarget = {
  dayKey: string;
  mealsCount: number;
  foodCount: number;
};

// Hide dropdown for the dashboard sections that don't render inside a single
// Card (Meals, Friends). Same affordance as the per-widget menu inside
// Card-shaped widgets. When `sort` is passed, also offers a persistent
// newest/oldest meal-order toggle; when `reset` is passed, a "Reset day" that
// clears the day's log.
export function SectionWidgetMenu({
  widgetId,
  label,
  sort,
  reset,
}: {
  widgetId: WidgetId;
  label: string;
  sort?: MealSortDir;
  /** Meals only, and only when the day has something to clear. */
  reset?: ResetDayTarget;
}) {
  const [pending, startTransition] = useTransition();
  // Held outside the dropdown: the menu unmounts its content when it closes,
  // so a dialog rendered inside would vanish with the click that opened it.
  const [resetOpen, setResetOpen] = useState(false);

  function hide() {
    startTransition(async () => {
      await setWidgetState(widgetId, "hidden");
    });
  }

  function sortBy(dir: MealSortDir) {
    if (dir === sort) return;
    startTransition(async () => {
      await setMealSort(dir);
    });
  }

  function confirmReset() {
    if (!reset) return;
    startTransition(async () => {
      await resetDay(reset.dayKey);
      setResetOpen(false);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`${label} options`}
          disabled={pending}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-expanded:bg-muted disabled:opacity-50"
        >
          <MoreHorizontal className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
          {sort != null && (
            <>
              <DropdownMenuGroup>
                <SortItem
                  label="Newest first"
                  icon={ArrowDownWideNarrow}
                  active={sort === "desc"}
                  onClick={() => sortBy("desc")}
                />
                <SortItem
                  label="Oldest first"
                  icon={ArrowUpWideNarrow}
                  active={sort === "asc"}
                  onClick={() => sortBy("asc")}
                />
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}
          {reset && (
            <>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setResetOpen(true)}
                className="cursor-pointer rounded-lg text-sm"
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5 opacity-70" />
                Reset day
              </DropdownMenuItem>
              {/* Keeps the one item that deletes data off the edge of the one
                  that just tidies the dashboard away. */}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            variant="destructive"
            onClick={hide}
            className="cursor-pointer rounded-lg text-sm"
          >
            <EyeOff className="mr-2 h-3.5 w-3.5 opacity-70" />
            Hide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {reset && (
        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent className="rounded-2xl sm:max-w-sm">
            <DialogTitle className="text-base font-semibold">
              Reset this day?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This deletes all {reset.mealsCount}{" "}
              {reset.mealsCount === 1 ? "meal" : "meals"} and{" "}
              {reset.foodCount} {reset.foodCount === 1 ? "food" : "foods"}{" "}
              logged on this day. Weight and activity stay. Can&apos;t be
              undone.
            </DialogDescription>

            <div className="mt-4 flex gap-2">
              <DialogClose
                render={<Button variant="ghost" className="flex-1 rounded-full" />}
              >
                Cancel
              </DialogClose>
              <Button
                onClick={confirmReset}
                disabled={pending}
                variant="destructive"
                className="flex-1 rounded-full"
              >
                {pending ? "Resetting…" : "Reset day"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function SortItem({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      className="cursor-pointer rounded-lg text-sm"
    >
      <Icon className="mr-2 h-3.5 w-3.5 opacity-70" />
      {label}
      {active && <Check className="ml-auto h-3.5 w-3.5" />}
    </DropdownMenuItem>
  );
}
