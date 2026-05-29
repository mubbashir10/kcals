"use client";

// shadcn-style wrapper for react-day-picker v10, themed against this app's
// Tailwind tokens (background / foreground / muted / accent / ring).
// Consumers can still pass `components` to override DayButton, etc.

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = DayPickerProps;

export function Calendar({
  className,
  classNames,
  components,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-full", className)}
      classNames={{
        months: "flex w-full flex-col gap-4",
        month: "space-y-2",
        month_caption: "relative flex h-9 items-center justify-center",
        caption_label: "text-sm font-semibold tabular-nums",
        nav: "absolute inset-x-0 flex items-center justify-between px-1",
        button_previous:
          "inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
        button_next:
          "inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7",
        weekday:
          "py-1 text-center text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70",
        weeks: "flex flex-col gap-px",
        week: "grid grid-cols-7 gap-px",
        day: "aspect-square p-0",
        day_button:
          "flex h-full w-full flex-col items-center justify-center gap-1 rounded-md text-xs tabular-nums text-foreground/90 transition-colors hover:bg-accent/40 outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        today: "font-semibold",
        outside: "text-muted-foreground/40",
        disabled: "opacity-30",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" {...rest} />
          ) : (
            <ChevronRight className="h-4 w-4" {...rest} />
          ),
        ...components,
      }}
      {...props}
    />
  );
}
