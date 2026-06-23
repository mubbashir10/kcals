"use client";

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The app's pill search field — Search icon, rounded input, and a clear
 * button that appears once there's a query. Controlled: the parent owns the
 * value. Used by the add-food search, the recipe-builder ingredient search,
 * and the foods / recipes list filters. `compact` is the smaller variant used
 * inside the recipe builder.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "rounded-full border-border/60 bg-card pl-11 pr-11 shadow-sm",
          compact ? "h-11 text-sm" : "h-12 text-base"
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear"
          className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
