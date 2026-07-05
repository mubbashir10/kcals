import { Logo } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";

// Neutral, centered skeleton for the sign-in page. Deliberately NOT the
// shared app shell: a signed-out visitor must never flash the authenticated
// home-dashboard skeleton (the nearest parent loading.tsx) before the form
// appears. Mirrors app/signin/page.tsx's centered logo + card layout.
export default function Loading() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo className="mb-5 h-14 w-14" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-3 h-3.5 w-56" />
        </div>
        <div className="w-full space-y-3 rounded-2xl border border-border/60 bg-card p-6">
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-10 w-full rounded-full" />
        </div>
      </main>
    </div>
  );
}
