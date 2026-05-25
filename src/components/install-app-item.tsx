"use client";

import { useEffect, useState } from "react";
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

// Chrome / Android exposes this event when the site meets the PWA install
// criteria (manifest + icons + served over HTTPS). We hold onto it so the
// user can trigger the install from our own UI.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Surface = "android" | "ios" | "desktop" | null;

// "Install app" menu item for the UserMenu. Three modes:
//   - Android (or any Chromium with beforeinstallprompt): triggers the
//     native install prompt directly.
//   - iOS Safari: opens a small dialog with the Share → Add to Home Screen
//     steps (iOS doesn't expose a programmatic install API).
//   - Already installed (display-mode: standalone): renders nothing.
export function InstallAppItem() {
  const [deferred, setDeferred] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [surface, setSurface] = useState<Surface>(null);
  const [iosHintOpen, setIosHintOpen] = useState(false);

  useEffect(() => {
    // Already installed → hide the affordance entirely.
    if (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari sets this when launched from the home-screen.
      (navigator as Navigator & { standalone?: boolean }).standalone
    ) {
      return;
    }

    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      // iPadOS 13+ reports as Macintosh; distinguish via touch support.
      (ua.includes("Mac") && "ontouchend" in document);
    const isAndroid = /Android/i.test(ua);

    if (isIOS) {
      setSurface("ios");
    } else if (isAndroid) {
      setSurface("android");
    } else {
      setSurface("desktop");
    }

    function onPrompt(e: Event) {
      // Prevent the mini-infobar; we want to trigger the prompt ourselves.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setDeferred(null);
      setSurface(null);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Show the menu item if either:
  //   (a) we captured a beforeinstallprompt → real install available
  //   (b) we're on iOS Safari → we can show the manual hint
  // Desktop without a captured prompt → hide (Chrome installs via the URL
  // bar icon; surfacing it in the user menu would be confusing).
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
      setIosHintOpen(true);
    }
  }

  return (
    <>
      <DropdownMenuItem
        onClick={onClick}
        className="cursor-pointer rounded-lg text-sm"
      >
        <Download className="mr-2 h-3.5 w-3.5 opacity-70" />
        Install app
      </DropdownMenuItem>

      <Dialog open={iosHintOpen} onOpenChange={setIosHintOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Smartphone className="h-4 w-4 text-emerald-500" />
            Add kcals to your home screen
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            iOS doesn't let websites install themselves — but it only takes
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
              render={
                <Button variant="ghost" className="rounded-full" />
              }
            >
              Got it
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
