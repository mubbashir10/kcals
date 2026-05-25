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

// A single-invite version of PendingInvitesList styled as a top-of-home
// banner. The home page renders one per pending invite.
export function IncomingInviteBanner({
  invite,
}: {
  invite: {
    id: number;
    token: string;
    inviterName: string | null;
    inviterEmail: string;
    inviterImage: string | null;
  };
}) {
  const [pending, startTransition] = useTransition();

  const initial =
    invite.inviterName?.trim()[0]?.toUpperCase() ??
    invite.inviterEmail.trim()[0]?.toUpperCase() ??
    "?";

  return (
    <Card className="flex items-center gap-3 rounded-2xl border-emerald-500/30 bg-emerald-500/[0.04] px-4 py-3 shadow-card">
      <Avatar className="h-9 w-9 ring-1 ring-emerald-500/30">
        {invite.inviterImage && (
          <AvatarImage src={invite.inviterImage} referrerPolicy="no-referrer" />
        )}
        <AvatarFallback className="bg-emerald-500/15 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          {initial}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {invite.inviterName ?? invite.inviterEmail}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          wants to share their daily stats with you
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={() => startTransition(() => acceptFriendInvite(invite.token).then(() => {}))}
        disabled={pending}
        className="bg-emerald-500 text-white hover:bg-emerald-500/90"
      >
        <Check className="h-3.5 w-3.5" />
        Accept
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => startTransition(() => declineFriendInvite(invite.id).then(() => {}))}
        disabled={pending}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </Card>
  );
}
