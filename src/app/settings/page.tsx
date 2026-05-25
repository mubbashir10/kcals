import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { UnitsSettings } from "@/components/units-settings";
import { WidgetsSettings } from "@/components/widgets-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const profile = await db.profile.findUnique({ where: { userId } });
  // Onboarding must finish first.
  if (!profile) redirect("/setup");

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-3 px-6">
          <Link
            href="/"
            aria-label="Back"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold tracking-tight">Settings</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Customize your home dashboard.
          </p>
        </div>

        <section className="mb-8 space-y-3">
          <h2 className="px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Preferences
          </h2>
          <UnitsSettings
            initial={profile.units as "metric" | "imperial"}
          />
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Widgets
          </h2>
          <WidgetsSettings
            initial={{
              maintenance: profile.widgetMaintenance as
                | "expanded"
                | "minimized"
                | "hidden",
              weight: profile.widgetWeight as
                | "expanded"
                | "minimized"
                | "hidden",
              calorieDisplay: profile.calorieDisplay as
                | "remaining"
                | "consumed",
            }}
          />
        </section>
      </main>
    </div>
  );
}
