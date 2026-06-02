import {
  Apple,
  CalendarRange,
  ChefHat,
  Check,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  Target,
  User,
  UserCircle,
  Users,
} from "lucide-react";

import { signOutAction } from "@/app/actions/auth";
import { getSession } from "@/lib/session";
import { AppLink } from "@/components/app-link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InstallAppDialog,
  InstallAppItem,
} from "@/components/install-app-item";
import { ThemeMenuGroup } from "@/components/theme-menu-group";

export async function UserMenu() {
  const session = await getSession();
  const user = session?.user;

  const initial =
    user?.name?.trim()[0]?.toUpperCase() ??
    user?.email?.trim()[0]?.toUpperCase() ??
    null;

  return (
    <>
      <InstallAppDialog />
      <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open menu"
        className="group inline-flex h-7 w-7 items-center justify-center rounded-full outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar className="h-7 w-7 ring-1 ring-border transition-all group-hover:ring-foreground/30 group-aria-expanded:ring-foreground/40">
          {user?.image && (
            <AvatarImage
              src={user.image}
              alt={user.name ?? "User"}
              referrerPolicy="no-referrer"
            />
          )}
          <AvatarFallback className="bg-muted text-xs font-semibold text-foreground/70">
            {initial ?? <User className="h-3.5 w-3.5" />}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 rounded-xl p-1.5"
      >
        {user && (
          <>
            <DropdownMenuGroup>
              <div className="px-2 py-1.5">
                <div className="truncate text-sm font-medium">
                  {user.name ?? "Signed in"}
                </div>
                {user.email && (
                  <div className="truncate text-[11px] text-muted-foreground">
                    {user.email}
                  </div>
                )}
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuGroup>
          <DropdownMenuItem
            render={
              <AppLink
                href="/week"
                className="cursor-pointer rounded-lg text-sm"
              />
            }
          >
            <CalendarRange className="mr-2 h-3.5 w-3.5 opacity-70" />
            Week summary
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <AppLink
                href="/setup"
                className="cursor-pointer rounded-lg text-sm"
              />
            }
          >
            <UserCircle className="mr-2 h-3.5 w-3.5 opacity-70" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <AppLink
                href="/goal"
                className="cursor-pointer rounded-lg text-sm"
              />
            }
          >
            <Target className="mr-2 h-3.5 w-3.5 opacity-70" />
            Goal
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <AppLink
                href="/recipes"
                className="cursor-pointer rounded-lg text-sm"
              />
            }
          >
            <ChefHat className="mr-2 h-3.5 w-3.5 opacity-70" />
            Recipes
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <AppLink
                href="/foods"
                className="cursor-pointer rounded-lg text-sm"
              />
            }
          >
            <Apple className="mr-2 h-3.5 w-3.5 opacity-70" />
            My foods
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <AppLink
                href="/friends"
                className="cursor-pointer rounded-lg text-sm"
              />
            }
          >
            <Users className="mr-2 h-3.5 w-3.5 opacity-70" />
            Friends
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <AppLink
                href="/settings"
                className="cursor-pointer rounded-lg text-sm"
              />
            }
          >
            <Settings className="mr-2 h-3.5 w-3.5 opacity-70" />
            Settings
          </DropdownMenuItem>
          <InstallAppItem />
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Theme
          </DropdownMenuLabel>
          <ThemeMenuGroup />
        </DropdownMenuGroup>

        {user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <form action={signOutAction}>
                <DropdownMenuItem
                  variant="destructive"
                  // The render target is a real <button type="submit"> so
                  // the form action fires — tell Base UI to skip its own
                  // button behavior layering.
                  nativeButton
                  render={
                    <button
                      type="submit"
                      className="w-full cursor-pointer rounded-lg text-sm"
                    />
                  }
                >
                  <LogOut className="mr-2 h-3.5 w-3.5 opacity-70" />
                  Sign out
                </DropdownMenuItem>
              </form>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export { Check, Monitor, Moon, Sun };
