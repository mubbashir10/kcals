"use client";

import { useTransition } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Check,
  EyeOff,
  MoreHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setWidgetState, setMealSort } from "@/app/actions/widgets";
import type { MealSortDir, WidgetId } from "@/lib/widget-order";

// Hide dropdown for the dashboard sections that don't render inside a single
// Card (Meals, Friends). Same affordance as the per-widget menu inside
// Card-shaped widgets. When `sort` is passed, also offers a persistent
// newest/oldest meal-order toggle.
export function SectionWidgetMenu({
  widgetId,
  label,
  sort,
}: {
  widgetId: WidgetId;
  label: string;
  sort?: MealSortDir;
}) {
  const [pending, startTransition] = useTransition();

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

  return (
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
