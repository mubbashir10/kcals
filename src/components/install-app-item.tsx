"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, Smartphone } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { isNative } from "@/lib/native";

// Chrome / Android exposes this event when the site meets the PWA install
// criteria (manifest + icons + served over HTTPS). We hold onto it so the
// user can trigger the install from our own UI.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Surface = "android" | "ios" | "desktop" | null;

// Bridge between the menu item (inside the dropdown's portal) and the iOS
// hint dialog (rendered outside the dropdown). The menu item dispatches this
// event when tapped on iOS, and the dialog component listens for it. We
// can't host the dialog inside the menu item itself: when the dropdown
// closes, its portal subtree unmounts and takes the dialog with it before
// it can open — that's the "flash and nothing" bug on iOS.
const IOS_HINT_EVENT = "kcals:install-ios-hint";

function detectSurface(): Surface {
  if (typeof window === "undefined") return null;
  if (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone
  ) {
    return null;
  }
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as Macintosh; distinguish via touch support.
    (ua.includes("Mac") && "ontouchend" in document);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

// Surface is derived from user-agent / display-mode and doesn't change
// during a session, so subscribe is a no-op. The server snapshot is null
// so we render nothing during SSR (no hydration mismatch).
const noSubscribe = () => () => {};
const serverSurface = (): Surface => null;

// "Install app" menu item for the UserMenu. Three modes:
//   - Android (or any Chromium with beforeinstallprompt): triggers the
//     native install prompt directly.
//   - iOS Safari: dispatches an event that InstallAppDialog (rendered
//     outside the dropdown) picks up to show the Add to Home Screen hint.
//   - Already installed (display-mode: standalone): renders nothing.
export function InstallAppItem() {
  const [deferred, setDeferred] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const detectedSurface = useSyncExternalStore(
    noSubscribe,
    detectSurface,
    serverSurface
  );
  // Nothing to install when we're already the installed native app.
  const surface = installed || isNative() ? null : detectedSurface;

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setDeferred(null);
      setInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const canShow =
    surface === "ios" || (surface === "android" && deferred !== null);

  if (!canShow) return null;

  async function onClick() {
    if (deferred) {
      await deferred.prompt();
      const result = await deferred.userChoice;
      if (result.outcome === "accepted") {
        setDeferred(null);
      }
      return;
    }
    if (surface === "ios") {
      window.dispatchEvent(new Event(IOS_HINT_EVENT));
    }
  }

  return (
    <DropdownMenuItem
      onClick={onClick}
      className="cursor-pointer rounded-lg text-sm"
    >
      <Download className="mr-2 h-3.5 w-3.5 opacity-70" />
      Install app
    </DropdownMenuItem>
  );
}

// Rendered as a sibling of the DropdownMenu (not inside it) so it survives
// the dropdown closing. Listens for the IOS_HINT_EVENT dispatched by the
// menu item.
export function InstallAppDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler() {
      setOpen(true);
    }
    window.addEventListener(IOS_HINT_EVENT, handler);
    return () => window.removeEventListener(IOS_HINT_EVENT, handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogTitle className="flex items-center gap-2 text-base font-semibold">
          <Smartphone className="h-4 w-4 text-emerald-500" />
          Add kcals to your home screen
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          iOS doesn&apos;t let websites install themselves — but it only takes
          two taps in Safari.
        </DialogDescription>

        <ol className="mt-4 space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
              1
            </span>
            <span className="flex-1">
              Tap the{" "}
              <Share className="inline-block h-4 w-4 align-text-bottom text-foreground/80" />{" "}
              <span className="font-medium">Share</span> button at the
              bottom of Safari.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
              2
            </span>
            <span className="flex-1">
              Scroll and tap{" "}
              <span className="font-medium">Add to Home Screen</span>, then{" "}
              <span className="font-medium">Add</span>.
            </span>
          </li>
        </ol>

        <p className="mt-4 text-xs text-muted-foreground">
          kcals will open without the browser bar, like a real app.
        </p>

        <div className="mt-4 flex justify-end">
          <DialogClose
            render={<Button variant="ghost" className="rounded-full" />}
          >
            Got it
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
