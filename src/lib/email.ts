// Email sending via Resend. Server-only.
//
// Configuration via env:
//   RESEND_API_KEY   API key from https://resend.com/api-keys
//   EMAIL_FROM       e.g. "kcals <invites@kcals.app>" — must be a verified
//                    sender domain on Resend (or use "onboarding@resend.dev"
//                    while testing — only delivers to the account owner).
//
// If RESEND_API_KEY is unset, send functions become no-ops and return
// `{ sent: false, reason: "not-configured" }`. The caller still has the
// invite URL to share manually.

import { Resend } from "resend";

type SendResult =
  | { sent: true }
  | { sent: false; reason: "not-configured" | "error"; message?: string };

let cached: Resend | null = null;

function client(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

function fromAddress(): string {
  // Sensible default for first-run / unverified domains. Resend will only
  // deliver mail from this address to the API-key owner's own email, which
  // is fine for personal use.
  return process.env.EMAIL_FROM || "kcals <onboarding@resend.dev>";
}

export async function sendInviteEmail({
  to,
  inviterName,
  inviterEmail,
  url,
}: {
  to: string;
  inviterName: string | null;
  inviterEmail: string;
  url: string;
}): Promise<SendResult> {
  const r = client();
  if (!r) return { sent: false, reason: "not-configured" };

  const friendly = inviterName?.trim() || inviterEmail;
  const subject = `${friendly} invited you to share calories on kcals`;

  try {
    const res = await r.emails.send({
      from: fromAddress(),
      to,
      subject,
      text: renderText({ friendly, inviterEmail, url }),
      html: renderHtml({ friendly, inviterEmail, url }),
    });
    if (res.error) {
      return { sent: false, reason: "error", message: res.error.message };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function renderText({
  friendly,
  inviterEmail,
  url,
}: {
  friendly: string;
  inviterEmail: string;
  url: string;
}) {
  return [
    `${friendly} (${inviterEmail}) invited you to share daily calories on kcals.`,
    ``,
    `You'll both see each other's calorie goals, macros, and meals — read-only.`,
    ``,
    `Accept the invite: ${url}`,
    ``,
    `If you don't know ${friendly}, just ignore this email.`,
    ``,
    `— kcals`,
  ].join("\n");
}

function renderHtml({
  friendly,
  inviterEmail,
  url,
}: {
  friendly: string;
  inviterEmail: string;
  url: string;
}) {
  // Intentionally minimal — looks fine in every mail client. No dark mode
  // gymnastics, no inline CSS gymnastics.
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:16px;padding:32px;">
      <div style="font-size:24px;font-weight:600;letter-spacing:-0.02em;background:linear-gradient(180deg,#84cc16,#10b981);-webkit-background-clip:text;background-clip:text;color:transparent;">kcals</div>
      <h1 style="font-size:18px;font-weight:600;margin:24px 0 8px;">${escapeHtml(friendly)} wants to share their calories with you</h1>
      <p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.5;">
        On kcals you'll both see each other's daily calorie goals, macros, and meals — read-only. No edits, no notifications, just a peek at the day.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${escapeAttr(url)}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:9999px;font-size:14px;font-weight:500;">Accept invite</a>
      </p>
      <p style="margin:0;color:#999;font-size:12px;line-height:1.5;">
        Or paste this link into your browser:<br>
        <span style="word-break:break-all;color:#666;">${escapeHtml(url)}</span>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="margin:0;color:#999;font-size:11px;line-height:1.5;">
        Invited by ${escapeHtml(inviterEmail)}. If you don't recognize that address, ignore this email.
      </p>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
