import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { validateAuthorizeRequest } from "@/lib/oauth";
import { getSession } from "@/lib/session";
import { getRequestOrigin } from "@/lib/site";

import { approveAuthorization, denyAuthorization } from "./actions";

export const dynamic = "force-dynamic";

// The OAuth consent screen an AI assistant sends the user to when it first
// connects to kcals over MCP. Middleware bounces a signed-out visitor through
// Google sign-in and back here with the query intact.
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined) params[k] = value;
  }

  const origin = getRequestOrigin(await headers());
  const result = await validateAuthorizeRequest(params, origin);
  if (!result.ok) {
    if ("redirectTo" in result) redirect(result.redirectTo);
    return <Message title="Can't connect" body={result.message} />;
  }

  // Middleware has already sent a signed-out visitor through sign-in.
  const session = await getSession();
  if (!session?.user) throw new Error("Not signed in");
  const query = new URLSearchParams(params).toString();

  const { client, redirectUri } = result.request;
  // Where the code goes is the one thing a lookalike client can't fake, so
  // show it next to the name the client chose for itself.
  const redirectUrl = new URL(redirectUri);
  const destination = redirectUrl.host || redirectUrl.protocol.replace(/:$/, "");

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-16">
        <Card className="w-full rounded-2xl border-border/60 p-6 shadow-card">
          <Logo className="mx-auto h-12 w-12" />

          <h1 className="mt-5 text-center text-xl font-semibold tracking-tight">
            Connect {client.name}?
          </h1>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            via {destination}
          </p>

          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            It will be able to do anything you can do in kcals as{" "}
            <span className="font-medium text-foreground">
              {session.user.email}
            </span>
            : read your diary, weight and goals, log and delete food, and add
            foods to the shared library.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            You can disconnect it any time in Settings.
          </p>

          <div className="mt-6 flex gap-2">
            <form action={denyAuthorization} className="flex-1">
              <input type="hidden" name="query" value={query} />
              <Button
                type="submit"
                variant="outline"
                className="h-9 w-full rounded-full text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </form>
            <form action={approveAuthorization} className="flex-1">
              <input type="hidden" name="query" value={query} />
              <Button
                type="submit"
                className="h-9 w-full rounded-full bg-emerald-500 text-white hover:bg-emerald-500/90"
              >
                <Check className="h-3.5 w-3.5" />
                Allow
              </Button>
            </form>
          </div>
        </Card>
      </main>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-16">
      <Card className="w-full rounded-2xl border-border/60 p-6 text-center shadow-card">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </Card>
    </main>
  );
}
