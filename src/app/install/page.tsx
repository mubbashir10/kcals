import type { Metadata } from "next";

import { Logo } from "@/components/logo";
import { Card } from "@/components/ui/card";
import { InstallGuide } from "./install-guide";

export const metadata: Metadata = {
  title: "Get the app",
  description: "Install kcals on your phone.",
};

export default function InstallPage() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]"
      />

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-4 h-14 w-14 drop-shadow-[0_8px_24px_oklch(0.7_0.18_145_/_0.35)]" />
          <h1 className="text-2xl font-semibold tracking-tight">Get kcals</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track meals, hit your goals, share with the people you eat with.
          </p>
        </div>

        <Card className="rounded-2xl border-border/60 p-6 shadow-card-lg">
          <InstallGuide />
        </Card>
      </main>
    </div>
  );
}
