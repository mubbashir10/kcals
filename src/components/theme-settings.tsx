"use client";

import { Monitor, Moon, Sun, SunMoon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "@/components/theme-provider";

const OPTIONS: { value: Theme; label: string; Icon: LucideIcon }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="pb-4">
      <div className="mb-3 flex items-center gap-2">
        <SunMoon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">Appearance</span>
      </div>
      <div className="flex w-full gap-1">
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-medium transition-all",
                active
                  ? "bg-foreground text-background shadow-card"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground/70">
        System follows your device&apos;s light or dark setting.
      </p>
    </div>
  );
}
