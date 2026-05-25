import Link from "next/link";
import { Plus } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { SectionWidgetMenu } from "@/components/section-widget-menu";
import { cn } from "@/lib/utils";
import type { FriendSummary } from "@/lib/friends";

// Horizontally-scrolling strip of friend mini-cards shown under the
// activity/weight widgets on the home page. The "+" tile always shows
// so users have an obvious path to invite someone.
export function FriendsStrip({ friends }: { friends: FriendSummary[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Friends</h2>
          {friends.length > 0 && (
            <Link
              href="/friends"
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Manage
            </Link>
          )}
        </div>
        <SectionWidgetMenu widgetId="friends" label="Friends" />
      </div>

      <div className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 [&::-webkit-scrollbar]:hidden">
        {friends.map((f) => (
          <FriendCard key={f.id} friend={f} />
        ))}

        <InviteTile compact={friends.length > 0} />
      </div>
    </section>
  );
}

function FriendCard({ friend }: { friend: FriendSummary }) {
  const initial =
    friend.name?.trim()[0]?.toUpperCase() ??
    friend.email.trim()[0]?.toUpperCase() ??
    "?";

  // Soft progress ring — uses the same gradient as the main calorie ring.
  const pct = friend.goalKcal
    ? Math.min(friend.consumedKcal / friend.goalKcal, 1.2)
    : 0;

  return (
    <Link
      href={`/friends/${friend.id}`}
      className="group shrink-0 snap-start"
    >
      <Card className="flex h-full w-40 flex-col items-center gap-3 rounded-2xl border-border/60 px-4 py-5 shadow-card transition-colors hover:bg-accent/30">
        <MiniRing size={64} strokeWidth={6} progress={pct}>
          <Avatar className="h-12 w-12">
            {friend.image && (
              <AvatarImage src={friend.image} referrerPolicy="no-referrer" />
            )}
            <AvatarFallback className="bg-muted text-sm font-semibold">
              {initial}
            </AvatarFallback>
          </Avatar>
        </MiniRing>
        <div className="w-full text-center">
          <div className="truncate text-xs font-medium">
            {friend.name ?? friend.email.split("@")[0]}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground tabular-nums">
            {friend.hasProfile && friend.goalKcal
              ? `${friend.consumedKcal} / ${friend.goalKcal}`
              : friend.hasProfile
                ? `${friend.consumedKcal} kcal`
                : "—"}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function InviteTile({ compact }: { compact: boolean }) {
  return (
    <Link
      href="/friends"
      className={cn(
        "group shrink-0 snap-start",
        compact ? "" : "flex-1"
      )}
    >
      <Card
        className={cn(
          "flex h-full flex-col items-center justify-center gap-2 rounded-2xl border-dashed border-border/60 bg-card/40 px-4 py-5 text-muted-foreground shadow-none transition-colors hover:bg-accent/30 hover:text-foreground",
          compact ? "w-40" : "w-full"
        )}
      >
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted/60">
          <Plus className="h-4 w-4" />
        </div>
        <div className="text-center">
          <div className="text-xs font-medium">
            {compact ? "Invite" : "Invite a friend"}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground/80">
            {compact ? "Share stats" : "See each other's daily stats"}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function MiniRing({
  size,
  strokeWidth,
  progress,
  children,
}: {
  size: number;
  strokeWidth: number;
  progress: number;
  children: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * Math.min(progress, 1);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <defs>
          <linearGradient id="friendRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.85 0.16 80)" />
            <stop offset="100%" stopColor="oklch(0.65 0.22 25)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        {progress > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#friendRing)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
