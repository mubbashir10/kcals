"use client";

import { useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  EyeOff,
  MoreHorizontal,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { setWidgetState } from "@/app/actions/widgets";
import type { WidgetId, WidgetState } from "@/lib/widget-order";

// Per-widget expand/minimize/hide dropdown. Used on every home-dashboard
// widget; the parent passes its own widgetId so the menu knows which row
// of widgetStates to write back to.
export function WidgetMenu({
  widgetId,
  current,
  label,
  canHide = true,
  size = "md",
}: {
  widgetId: WidgetId;
  current: WidgetState;
  // Used as the aria-label so screen readers can distinguish menus.
  label: string;
  // Set false to remove the "Hide" item (e.g. for a widget that must
  // always be visible).
  canHide?: boolean;
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();

  function set(next: WidgetState) {
    if (next === current) return;
    startTransition(async () => {
      await setWidgetState(widgetId, next);
    });
  }

  const triggerSize =
    size === "sm" ? "h-6 w-6" : "h-7 w-7";
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
          {current !== "expanded" && (
            <DropdownMenuItem
              className="cursor-pointer rounded-lg text-sm"
              onClick={() => set("expanded")}
            >
              <ChevronDown className="mr-2 h-3.5 w-3.5 opacity-70" />
              Expand
            </DropdownMenuItem>
          )}
          {current !== "minimized" && (
            <DropdownMenuItem
              className="cursor-pointer rounded-lg text-sm"
              onClick={() => set("minimized")}
            >
              <ChevronUp className="mr-2 h-3.5 w-3.5 opacity-70" />
              Minimize
            </DropdownMenuItem>
          )}
          {canHide && (
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer rounded-lg text-sm"
              onClick={() => set("hidden")}
            >
              <EyeOff className="mr-2 h-3.5 w-3.5 opacity-70" />
              Hide
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
