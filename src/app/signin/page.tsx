import { Flame, Target, Users } from "lucide-react";

import { signIn } from "@/auth";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { GoogleSignInButton } from "./google-sign-in-button";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const sp = await searchParams;
  const redirectTo = sp.from ?? "/";

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(circle_at_50%_120%,oklch(0.9_0.14_145_/_0.18),transparent_55%)]"
      />

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-emerald-400/30 blur-2xl"
            />
            <Logo className="h-16 w-16 drop-shadow-[0_8px_24px_oklch(0.7_0.18_145_/_0.35)]" />
          </div>
          <h1 className="bg-gradient-to-b from-lime-400 to-emerald-500 bg-clip-text text-4xl font-semibold leading-none tracking-tight text-transparent">
            kcals
          </h1>
          <p className="mt-3 max-w-[20rem] text-sm leading-relaxed text-muted-foreground">
            Track meals, hit your goals, share with the people you eat with.
          </p>
        </div>

        <Card className="relative w-full overflow-hidden rounded-2xl border-border/60 p-6 shadow-card-lg">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
          />

          <h2 className="text-base font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Use your Google account to continue.
          </p>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
            className="mt-5"
          >
            <GoogleSignInButton redirectTo={redirectTo}>
              <GoogleMark />
              Continue with Google
            </GoogleSignInButton>
          </form>
        </Card>

        <div className="mt-8 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
          <FeaturePill icon={Flame} label="Track" />
          <Dot />
          <FeaturePill icon={Target} label="Goals" />
          <Dot />
          <FeaturePill icon={Users} label="Together" />
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
          We only read your name and email — nothing else.
        </p>

        <a
          href="/install"
          className="mt-6 text-xs font-medium text-emerald-500 transition-colors hover:text-emerald-400"
        >
          Get the Android app →
        </a>
      </main>
    </div>
  );
}

function FeaturePill({
  icon: Icon,
  label,
}: {
  icon: typeof Flame;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-muted-foreground/40">
      ·
    </span>
  );
}

function GoogleMark() {
  // Official Google "G" logo, inlined SVG.
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
