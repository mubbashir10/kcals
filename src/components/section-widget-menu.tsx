"use client";

import { useTransition } from "react";
import { EyeOff, MoreHorizontal } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setWidgetState } from "@/app/actions/widgets";
import type { WidgetId } from "@/lib/widget-order";

// Hide dropdown for the dashboard sections that don't render inside a single
// Card (Meals, Friends). Same affordance as the per-widget menu inside
// Card-shaped widgets.
export function SectionWidgetMenu({
  widgetId,
  label,
}: {
  widgetId: WidgetId;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  function hide() {
    startTransition(async () => {
      await setWidgetState(widgetId, "hidden");
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
