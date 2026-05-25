"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { sendInviteEmail } from "@/lib/email";
import { areFriends, normEmail } from "@/lib/friends";
import { requireUserId } from "@/lib/session";
import { auth } from "@/auth";

// Random URL-safe token used in /friends/accept/[token] links.
function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export type InviteResult = {
  inviteId: number;
  token: string;
  url: string;
  // Email delivery status. Only meaningful when the invite has an email.
  //   "sent"            email left our system
  //   "not-configured"  Resend not wired up — caller should ask user to copy
  //   "failed"          delivery error — caller should fall back to copy
  //   "no-email"        link-only invite, no email to send
  emailStatus: "sent" | "not-configured" | "failed" | "no-email";
  emailError?: string;
};

// Send an invite — by email, or as a shareable link (no email).
export async function sendFriendInvite(
  formData: FormData
): Promise<{ ok: true; result: InviteResult } | { ok: false; error: string }> {
  const inviterId = await requireUserId();

  const rawEmail = (formData.get("email") as string | null)?.trim() || "";
  const email = rawEmail ? normEmail(rawEmail) : null;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That doesn't look like a valid email." };
  }

  const inviter = await db.user.findUnique({
    where: { id: inviterId },
    select: { name: true, email: true },
  });
  if (email && inviter?.email && normEmail(inviter.email) === email) {
    return { ok: false, error: "You can't invite yourself." };
  }

  // If a user with that email already exists and is already a friend,
  // surface that instead of silently creating a no-op invite.
  if (email) {
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing && (await areFriends(inviterId, existing.id))) {
      return { ok: false, error: "You're already friends with that person." };
    }
  }

  // Reuse a still-pending invite to the same email instead of stacking up.
  if (email) {
    const reusable = await db.friendInvite.findFirst({
      where: {
        inviterId,
        email,
        acceptedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });
    if (reusable) {
      const url = inviteUrl(reusable.token);
      const emailStatus = await deliver(email, inviter, url);
      revalidatePath("/friends");
      return {
        ok: true,
        result: {
          inviteId: reusable.id,
          token: reusable.token,
          url,
          emailStatus: emailStatus.status,
          emailError: emailStatus.error,
        },
      };
    }
  }

  const token = newToken();
  const created = await db.friendInvite.create({
    data: {
      token,
      inviterId,
      email,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  const url = inviteUrl(token);
  const emailStatus: { status: InviteResult["emailStatus"]; error?: string } =
    email ? await deliver(email, inviter, url) : { status: "no-email" };

  revalidatePath("/friends");
  revalidatePath("/");
  return {
    ok: true,
    result: {
      inviteId: created.id,
      token,
      url,
      emailStatus: emailStatus.status,
      emailError: emailStatus.error,
    },
  };
}

// Deliver an invite email and normalize the result into a status shape
// the UI can branch on.
async function deliver(
  to: string,
  inviter: { name: string | null; email: string | null } | null,
  url: string
): Promise<{
  status: "sent" | "not-configured" | "failed";
  error?: string;
}> {
  const res = await sendInviteEmail({
    to,
    inviterName: inviter?.name ?? null,
    inviterEmail: inviter?.email ?? "someone",
    url,
  });
  if (res.sent) return { status: "sent" };
  if (res.reason === "not-configured") return { status: "not-configured" };
  return { status: "failed", error: res.message };
}

// Accept an invite via token. Called from /friends/accept/[token] and
// from the home-page banner. Verifies that the signed-in user is the
// intended recipient when `email` was set on the invite.
export async function acceptFriendInvite(
  token: string
): Promise<
  | { ok: true; friendUserId: string }
  | { ok: false; error: string; status?: "expired" | "wrong-account" | "not-found" }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You need to sign in first." };
  }
  const acceptorId = session.user.id;
  const acceptorEmail = session.user.email
    ? normEmail(session.user.email)
    : null;

  const invite = await db.friendInvite.findUnique({ where: { token } });
  if (!invite) {
    return { ok: false, error: "Invite not found.", status: "not-found" };
  }

  if (invite.acceptedAt) {
    // Already accepted — treat as success if we're the one who accepted it.
    if (invite.acceptedById === acceptorId) {
      return { ok: true, friendUserId: invite.inviterId };
    }
    return { ok: false, error: "This invite has already been used." };
  }

  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This invite has expired.", status: "expired" };
  }

  if (invite.inviterId === acceptorId) {
    return { ok: false, error: "You can't accept your own invite." };
  }

  if (invite.email && (!acceptorEmail || invite.email !== acceptorEmail)) {
    return {
      ok: false,
      error: `This invite is for ${invite.email}. Sign in with that account to accept.`,
      status: "wrong-account",
    };
  }

  // Create friendship if missing. Canonical ordering: smaller id first.
  const [userAId, userBId] =
    invite.inviterId < acceptorId
      ? [invite.inviterId, acceptorId]
      : [acceptorId, invite.inviterId];

  await db.$transaction([
    db.friendship.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId },
      update: {},
    }),
    db.friendInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), acceptedById: acceptorId },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/friends");
  return { ok: true, friendUserId: invite.inviterId };
}

// Inviter cancels a pending invite they sent.
export async function cancelFriendInvite(inviteId: number) {
  const userId = await requireUserId();
  await db.friendInvite.deleteMany({
    where: { id: inviteId, inviterId: userId, acceptedAt: null },
  });
  revalidatePath("/friends");
}

// Recipient declines an incoming invite addressed to their email. We just
// delete the row — same effect as "no thanks", no audit trail needed yet.
export async function declineFriendInvite(inviteId: number) {
  const session = await auth();
  if (!session?.user?.email) return;
  const email = normEmail(session.user.email);

  await db.friendInvite.deleteMany({
    where: { id: inviteId, email, acceptedAt: null },
  });
  revalidatePath("/");
  revalidatePath("/friends");
}

// Remove a friendship (either side can do this).
export async function removeFriend(friendUserId: string) {
  const userId = await requireUserId();
  const [userAId, userBId] =
    userId < friendUserId ? [userId, friendUserId] : [friendUserId, userId];
  await db.friendship.deleteMany({ where: { userAId, userBId } });
  revalidatePath("/");
  revalidatePath("/friends");
  revalidatePath(`/friends/${friendUserId}`);
}

function inviteUrl(token: string): string {
  // Prefer an explicit public URL (set by Vercel) so links work in shared
  // contexts; fall back to relative for local dev.
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "");
  return `${base}/friends/accept/${token}`;
}
