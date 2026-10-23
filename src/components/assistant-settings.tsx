"use client";

import { useTransition } from "react";
import { Check, Copy, Plug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { disconnectAssistant } from "@/app/actions/assistants";
import { useCopy } from "@/lib/use-copy";

export type AssistantConnection = {
  id: string;
  name: string;
  /** Pre-formatted on the server, in the user's timezone. */
  lastActive: string;
};

// Where an AI assistant (Claude, ChatGPT, …) gets connected: the MCP URL to
// paste into its "add connector" screen, and the ones already connected.
export function AssistantSettings({
  mcpUrl,
  connections,
}: {
  mcpUrl: string;
  connections: AssistantConnection[];
}) {
  const [copied, copy] = useCopy();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Plug className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">AI assistants</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        Let Claude, ChatGPT or any MCP app log food and read your day for you.
        Add a custom connector with this URL, then sign in when it asks.
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 py-1.5 pl-3 pr-1.5">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{mcpUrl}</code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => copy(mcpUrl)}
          className="h-7 shrink-0 rounded-lg px-2 text-xs"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      {connections.length > 0 && (
        <ul className="mt-3 divide-y divide-border/60">
          {connections.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{c.name}</div>
                <div className="text-xs text-muted-foreground">Last active: {c.lastActive}</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => startTransition(() => disconnectAssistant(c.id))}
                className="h-7 rounded-full px-3 text-xs"
              >
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
