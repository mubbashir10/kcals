"use client";

import { useTransition } from "react";
import { ChevronRight, UserMinus } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { removeFriend } from "@/app/actions/friends";
import type { FriendSummary } from "@/lib/friends";

export function FriendsList({ friends }: { friends: FriendSummary[] }) {
  if (friends.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-10 text-center shadow-none">
        <p className="text-sm text-muted-foreground">No friends yet.</p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Invite someone above — they’ll show up here once they accept.
        </p>
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-border/60 rounded-2xl border-border/60 p-0 shadow-card">
      {friends.map((f) => (
        <FriendRow key={f.id} friend={f} />
      ))}
    </Card>
  );
}

function FriendRow({ friend }: { friend: FriendSummary }) {
  const [pending, startTransition] = useTransition();
  const initial =
    friend.name?.trim()[0]?.toUpperCase() ??
    friend.email.trim()[0]?.toUpperCase() ??
    "?";

  const subtitle = !friend.hasProfile
    ? "Hasn't finished setup"
    : friend.goalKcal
      ? `${friend.consumedKcal} / ${friend.goalKcal} kcal today`
      : `${friend.consumedKcal} kcal today`;

  function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Remove ${friend.name ?? friend.email} from friends?`)) return;
    startTransition(async () => {
      await removeFriend(friend.id);
    });
  }

  return (
    <AppLink
      href={`/friends/${friend.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/30"
    >
      <Avatar className="h-9 w-9">
        {friend.image && (
          <AvatarImage src={friend.image} referrerPolicy="no-referrer" />
        )}
        <AvatarFallback className="bg-muted text-sm font-semibold">
          {initial}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {friend.name ?? friend.email}
        </div>
        <div className="truncate text-[11px] text-muted-foreground tabular-nums">
          {subtitle}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={remove}
        disabled={pending}
        aria-label="Remove friend"
      >
        <UserMinus className="h-3.5 w-3.5" />
      </Button>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </AppLink>
  );
}
