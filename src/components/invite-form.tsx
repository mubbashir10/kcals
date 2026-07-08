"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { sendFriendInvite } from "@/app/actions/friends";

type Mode = "email" | "link";

export function InviteForm() {
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  function reset() {
    setError(null);
    setSentMessage(null);
    setLinkUrl(null);
    setLinkCopied(false);
  }

  function submit() {
    reset();
    const fd = new FormData();
    if (mode === "email") {
      if (!email.trim()) {
        setError("Enter an email to invite.");
        return;
      }
      fd.set("email", email.trim());
    }
    startTransition(async () => {
      const res = await sendFriendInvite(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }

      if (mode === "link") {
        setLinkUrl(res.result.url);
        return;
      }

      // Email mode — branch on whether Resend actually delivered. We always
      // show the link as a fallback so the user can hand it over manually if
      // delivery fails or email isn't configured.
      const target = email.trim();
      switch (res.result.emailStatus) {
        case "sent":
          setSentMessage(`Email sent to ${target}.`);
          setEmail("");
          break;
        case "not-configured":
          setSentMessage(
            `Email isn't configured yet — share this link with ${target} instead.`
          );
          setLinkUrl(res.result.url);
          setEmail("");
          break;
        case "failed":
          setError(
            `Couldn't send the email${
              res.result.emailError ? ` (${res.result.emailError})` : ""
            }. Share this link instead.`
          );
          setLinkUrl(res.result.url);
          break;
        default:
          setLinkUrl(res.result.url);
      }
    });
  }

  async function copyLink() {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      // Clipboard can fail in iframes / insecure contexts — just leave the
      // URL on screen for the user to select manually.
    }
  }

  return (
    <div className="space-y-3">
      <ModeToggle mode={mode} onChange={(m) => { setMode(m); reset(); }} />

      {mode === "email" ? (
        <div className="space-y-2">
          <Input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            autoComplete="email"
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Generate a one-time link anyone can use to become your friend.
        </p>
      )}

      <Button
        type="button"
        onClick={submit}
        disabled={pending || (mode === "email" && !email.trim())}
        className="w-full"
      >
        {mode === "email" ? "Send invite" : "Generate link"}
      </Button>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {sentMessage && (
        <p className="text-xs text-muted-foreground">{sentMessage}</p>
      )}

      {linkUrl && (
        <div className="rounded-xl bg-muted/60 p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Share this link
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-background px-2 py-1.5 text-[11px] tabular-nums text-foreground/80">
              {linkUrl}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={copyLink}
              aria-label="Copy link"
            >
              {linkCopied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const options: { value: Mode; label: string; icon: typeof Mail }[] = [
    { value: "email", label: "By email", icon: Mail },
    { value: "link", label: "Share link", icon: Link2 },
  ];
  return (
    <div className="inline-flex w-full rounded-full bg-muted p-1">
      {options.map(({ value, label, icon: Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
