"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Mail, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cancelFriendInvite } from "@/app/actions/friends";

export function PendingInviteRow({
  id,
  token,
  email,
  createdAt,
}: {
  id: number;
  token: string;
  email: string | null;
  createdAt: string;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/friends/accept/${token}`
      : `/friends/accept/${token}`;

  function copy() {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {});
  }

  function cancel() {
    startTransition(async () => {
      await cancelFriendInvite(id);
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground">
        {email ? <Mail className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {email ?? "Share link"}
        </div>
        <div className="text-[10px] text-muted-foreground">
          Sent {formatRelative(createdAt)}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={copy}
        aria-label="Copy invite link"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={cancel}
        disabled={pending}
        aria-label="Cancel invite"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
