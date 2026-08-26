"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMeal } from "@/app/actions/meals";
import { dashedPill } from "@/lib/pill";

export function NewMealButton({
  suggestedName,
  dayKey = null,
}: {
  suggestedName: string;
  /** Day to create the meal on. `null`/omitted means today. */
  dayKey?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function onOpen(next: boolean) {
    if (next) setName("");
    setOpen(next);
  }

  function onCreate() {
    startTransition(async () => {
      await createMeal(name, dayKey);
      setOpen(false);
      setName("");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={dashedPill()}
      >
        <Sparkles className="h-3.5 w-3.5" />
        New meal
      </button>

      <Dialog open={open} onOpenChange={onOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogTitle className="text-base font-semibold">
            Start a new meal
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Give it a name, or leave blank to use the default.
          </DialogDescription>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="new-meal-name"
                className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                Name
              </Label>
              <Input
                id="new-meal-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={suggestedName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onCreate();
                  }
                }}
              />
            </div>

            <div className="flex gap-2">
              <DialogClose
                render={
                  <Button variant="ghost" className="flex-1 rounded-full" />
                }
              >
                Cancel
              </DialogClose>
              <Button
                onClick={onCreate}
                disabled={pending}
                className="flex-1 rounded-full"
              >
                {pending ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
