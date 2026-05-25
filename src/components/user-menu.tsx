"use client";

import Link from "next/link";
import { Check, Monitor, Moon, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEMES = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export function UserMenu() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open menu"
        className="group inline-flex h-8 w-8 items-center justify-center rounded-full outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar className="h-8 w-8 ring-1 ring-border transition-all group-hover:ring-foreground/30 group-aria-expanded:ring-foreground/40">
          <AvatarFallback className="bg-gradient-to-br from-amber-400 to-rose-500 text-white">
            <User className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-52 rounded-xl p-1.5"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={
              <Link
                href="/setup"
                className="cursor-pointer rounded-lg text-sm"
              />
            }
          >
            Profile
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Theme
          </DropdownMenuLabel>
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
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
