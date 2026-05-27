import { redirect } from "next/navigation";
import { Check, X } from "lucide-react";

import { AppLink } from "@/components/app-link";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { acceptFriendInvite } from "@/app/actions/friends";
import { db } from "@/lib/db";
import { areFriends, normEmail } from "@/lib/friends";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const now = new Date();

  const session = await getSession();
  if (!session?.user?.id) {
    // Bounce through sign-in, then come right back here.
    redirect(`/signin?from=/friends/accept/${encodeURIComponent(token)}`);
  }
  const userId = session.user.id;
  const userEmail = session.user.email ? normEmail(session.user.email) : null;

  const invite = await db.friendInvite.findUnique({
    where: { token },
    include: {
      inviter: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  // Possible outcomes — show a clear page for each rather than redirecting
  // through opaque error states.
  if (!invite) {
    return <Message title="Invite not found" body="This link is invalid or has been cancelled." />;
  }

  if (invite.acceptedAt) {
    // If you accepted it, take you to the friend page; otherwise show used state.
    if (invite.acceptedById === userId) {
      redirect(`/friends/${invite.inviterId}`);
    }
    return <Message title="Already used" body="This invite has already been accepted by someone else." />;
  }

  if (invite.expiresAt && invite.expiresAt.getTime() < now.getTime()) {
    return <Message title="Invite expired" body="Ask the sender for a new one." />;
  }

  if (invite.inviterId === userId) {
    return (
      <Message
        title="That's your own invite"
        body="Share the link with the person you want to invite."
      />
    );
  }

  if (invite.email && (!userEmail || invite.email !== userEmail)) {
    return (
      <Message
        title="Wrong account"
        body={`This invite is for ${invite.email}. Sign out and sign back in with that Google account to accept.`}
      />
    );
  }

  if (await areFriends(userId, invite.inviterId)) {
    redirect(`/friends/${invite.inviterId}`);
  }

  // All clear — show a confirmation card. The actual create happens via a
  // server-action form so it's a single explicit POST.
  const inviter = invite.inviter;
  const initial =
    inviter.name?.trim()[0]?.toUpperCase() ??
    inviter.email.trim()[0]?.toUpperCase() ??
    "?";

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-16">
        <Card className="w-full rounded-2xl border-border/60 p-6 text-center shadow-card">
          <Avatar className="mx-auto h-16 w-16 ring-1 ring-border">
            {inviter.image && (
              <AvatarImage src={inviter.image} referrerPolicy="no-referrer" />
            )}
            <AvatarFallback className="bg-muted text-xl font-semibold">
              {initial}
            </AvatarFallback>
          </Avatar>

          <h1 className="mt-5 text-xl font-semibold tracking-tight">
            {inviter.name ?? inviter.email}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            wants to share their daily calories and goals with you
          </p>

          <form
            action={async () => {
              "use server";
              const res = await acceptFriendInvite(token);
              if (res.ok) {
                redirect(`/friends/${res.friendUserId}`);
              }
              // Fallback — render the same page; user will see the
              // appropriate Message branch on reload.
              redirect(`/friends/accept/${encodeURIComponent(token)}`);
            }}
            className="mt-6 flex gap-2"
          >
            <AppLink
              href="/"
              direction="back"
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
              Not now
            </AppLink>
            <Button
              type="submit"
              className="h-9 flex-1 rounded-full bg-emerald-500 text-white hover:bg-emerald-500/90"
            >
              <Check className="h-3.5 w-3.5" />
              Accept
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-16">
        <Card className="w-full rounded-2xl border-border/60 p-6 text-center shadow-card">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          <AppLink
            href="/"
            direction="back"
            className="mt-6 inline-flex h-9 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Go home
          </AppLink>
        </Card>
      </main>
    </div>
  );
}
