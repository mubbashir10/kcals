"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

const THEMES = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export function ThemeMenuGroup() {
  const { theme, setTheme } = useTheme();
  return (
    <>
      {THEMES.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className="cursor-pointer rounded-lg text-sm"
          >
            <Icon className="mr-2 h-3.5 w-3.5 opacity-70" />
            <span>{label}</span>
            {active && <Check className="ml-auto h-3.5 w-3.5" />}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
