import { redirect } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { FriendsList } from "@/components/friends-list";
import { InviteForm } from "@/components/invite-form";
import { PendingInviteRow } from "@/components/pending-invite-row";
import { PendingInvitesList } from "@/components/pending-invites-list";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  listFriendSummaries,
  pendingInvitesForUser,
  pendingInvitesFromUser,
} from "@/lib/friends";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const userEmail = session.user.email ?? null;

  // Make sure they've gone through onboarding — same gate as the home page.
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) redirect("/setup");

  const [friends, sentInvites, incomingInvites] = await Promise.all([
    listFriendSummaries(userId),
    pendingInvitesFromUser(userId),
    userEmail ? pendingInvitesForUser(userEmail) : Promise.resolve([]),
  ]);

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-3 px-6">
          <AppLink
            href="/"
            direction="back"
            aria-label="Back"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </AppLink>
          <span className="text-sm font-semibold tracking-tight">Friends</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Friends</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Share your daily calories and goals with people you trust.
          </p>
        </div>

        {incomingInvites.length > 0 && (
          <section className="mb-8 space-y-3">
            <h2 className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Pending for you
            </h2>
            <PendingInvitesList
              invites={incomingInvites.map((i) => ({
                id: i.id,
                token: i.token,
                inviterName: i.inviter.name,
                inviterEmail: i.inviter.email,
                inviterImage: i.inviter.image,
              }))}
            />
          </section>
        )}

        <section className="mb-8 space-y-3">
          <h2 className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <UserPlus className="h-3 w-3" />
              Invite someone
            </span>
          </h2>
          <Card className="rounded-2xl border-border/60 p-4 shadow-card">
            <InviteForm />
          </Card>
        </section>

        {sentInvites.length > 0 && (
          <section className="mb-8 space-y-3">
            <h2 className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Sent
            </h2>
            <Card className="divide-y divide-border/60 rounded-2xl border-border/60 p-0 shadow-card">
              {sentInvites.map((i) => (
                <PendingInviteRow
                  key={i.id}
                  id={i.id}
                  token={i.token}
                  email={i.email}
                  createdAt={i.createdAt.toISOString()}
                />
              ))}
            </Card>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Your friends
          </h2>
          <FriendsList friends={friends} />
        </section>
      </main>
    </div>
  );
}
