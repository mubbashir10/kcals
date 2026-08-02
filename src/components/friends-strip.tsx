import { Plus } from "lucide-react";

import { AppLink } from "@/components/app-link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { SectionWidgetMenu } from "@/components/section-widget-menu";
import type { FriendSummary } from "@/lib/friends";
import { percentOfGoal } from "@/lib/utils";

// Vertical list of friend rows shown on the home page. Each row has the
// friend's progress bar inline so the user can scan everyone's day without
// horizontal scrolling — important on narrow screens where a carousel of
// cards eats too much vertical space and only shows one or two friends.
export function FriendsStrip({ friends }: { friends: FriendSummary[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Friends</h2>
          {friends.length > 0 && (
            <AppLink
              href="/friends"
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Manage
            </AppLink>
          )}
        </div>
        <SectionWidgetMenu widgetId="friends" label="Friends" />
      </div>

      <Card className="divide-y divide-border/60 overflow-hidden rounded-2xl border-border/60 p-0 shadow-card">
        {friends.map((f) => (
          <FriendRow key={f.id} friend={f} />
        ))}
        <InviteRow />
      </Card>
    </section>
  );
}

function FriendRow({ friend }: { friend: FriendSummary }) {
  const initial =
    friend.name?.trim()[0]?.toUpperCase() ??
    friend.email.trim()[0]?.toUpperCase() ??
    "?";
  const displayName = friend.name ?? friend.email.split("@")[0];

  const pct = percentOfGoal(friend.consumedKcal, friend.goalKcal);

  return (
    <AppLink
      href={`/friends/${friend.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/30"
    >
      <Avatar className="h-10 w-10 shrink-0">
        {friend.image && (
          <AvatarImage src={friend.image} referrerPolicy="no-referrer" />
        )}
        <AvatarFallback className="bg-muted text-sm font-semibold">
          {initial}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{displayName}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {friend.hasProfile && friend.goalKcal
              ? `${friend.consumedKcal.toLocaleString()} / ${friend.goalKcal.toLocaleString()}`
              : friend.hasProfile
                ? `${friend.consumedKcal.toLocaleString()} kcal`
                : "—"}
          </span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          {friend.goalKcal && (
            <div
              className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-500 transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      </div>
    </AppLink>
  );
}

function InviteRow() {
  return (
    <AppLink
      href="/friends"
      className="flex items-center gap-3 px-4 py-3 text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted/60">
        <Plus className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">Invite a friend</div>
        <div className="text-[11px] text-muted-foreground/80">
          See each other&apos;s daily stats
        </div>
      </div>
    </AppLink>
  );
}
