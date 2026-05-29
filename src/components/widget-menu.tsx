"use client";

import { useTransition } from "react";
import { EyeOff, MoreHorizontal } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { setWidgetState } from "@/app/actions/widgets";
import type { WidgetId } from "@/lib/widget-order";

// Per-widget hide dropdown. Used on every home-dashboard widget; the parent
// passes its own widgetId so the menu knows which row of widgetStates to
// write back to. Widgets are either shown or hidden — re-show them from
// Settings.
export function WidgetMenu({
  widgetId,
  label,
  canHide = true,
  size = "md",
}: {
  widgetId: WidgetId;
  // Used as the aria-label so screen readers can distinguish menus.
  label: string;
  // Set false to remove the menu entirely (e.g. for a widget that must
  // always be visible).
  canHide?: boolean;
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();

  if (!canHide) return null;

  function hide() {
    startTransition(async () => {
      await setWidgetState(widgetId, "hidden");
    });
  }

  const triggerSize = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label} options`}
        disabled={pending}
        className={cn(
          "inline-flex items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-expanded:bg-muted disabled:opacity-50",
          triggerSize
        )}
      >
        <MoreHorizontal className={iconSize} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer rounded-lg text-sm"
            onClick={hide}
          >
            <EyeOff className="mr-2 h-3.5 w-3.5 opacity-70" />
            Hide
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
