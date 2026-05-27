import { ArrowLeft } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { requireProfile } from "@/lib/session";
import { parseWidgetStates } from "@/lib/widget-order";
import { TimezoneSettings } from "@/components/timezone-settings";
import { UnitsSettings } from "@/components/units-settings";
import { WidgetsSettings } from "@/components/widgets-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { profile } = await requireProfile();

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
          <TimezoneSettings initial={profile.timezone} />
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Widgets
          </h2>
          <WidgetsSettings
            initial={{
              states: parseWidgetStates(profile.widgetStates),
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
