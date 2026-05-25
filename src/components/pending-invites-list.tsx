"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  acceptFriendInvite,
  declineFriendInvite,
} from "@/app/actions/friends";

export type IncomingInvite = {
  id: number;
  token: string;
  inviterName: string | null;
  inviterEmail: string;
  inviterImage: string | null;
};

export function PendingInvitesList({ invites }: { invites: IncomingInvite[] }) {
  if (invites.length === 0) return null;
  return (
    <Card className="divide-y divide-border/60 rounded-2xl border-border/60 p-0 shadow-card">
      {invites.map((inv) => (
        <Row key={inv.id} invite={inv} />
      ))}
    </Card>
  );
}

function Row({ invite }: { invite: IncomingInvite }) {
  const [pending, startTransition] = useTransition();
  const initial =
    invite.inviterName?.trim()[0]?.toUpperCase() ??
    invite.inviterEmail.trim()[0]?.toUpperCase() ??
    "?";

  function accept() {
    startTransition(async () => {
      await acceptFriendInvite(invite.token);
    });
  }

  function decline() {
    startTransition(async () => {
      await declineFriendInvite(invite.id);
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar className="h-8 w-8">
        {invite.inviterImage && (
          <AvatarImage src={invite.inviterImage} referrerPolicy="no-referrer" />
        )}
        <AvatarFallback className="bg-muted text-xs font-semibold">
          {initial}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {invite.inviterName ?? invite.inviterEmail}
        </div>
        <div className="truncate text-[10px] text-muted-foreground">
          wants to share their stats
        </div>
      </div>
      <Button
        type="button"
        size="icon-sm"
        onClick={accept}
        disabled={pending}
        aria-label="Accept"
        className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400"
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={decline}
        disabled={pending}
        aria-label="Decline"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
