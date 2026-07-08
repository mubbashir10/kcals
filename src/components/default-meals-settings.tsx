"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  addDefaultMeal,
  deleteDefaultMeal,
  listDefaultMeals,
  updateDefaultMeal,
} from "@/app/actions/default-meals";

type DefaultMealRow = Awaited<ReturnType<typeof listDefaultMeals>>[number];

export function DefaultMealsSettings({ initial }: { initial: DefaultMealRow[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newTime, setNewTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    const name = newName.trim();
    if (!name || !newTime) {
      setError("Add a name and a time.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addDefaultMeal(name, newTime);
        setNewName("");
        setNewTime("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't add that.");
      }
    });
  }

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="mb-1 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">Default meals</span>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground/70">
        Meals that appear on every new day, ready to log into. Leave empty to
        keep creating meals as you go.
      </p>

      {initial.length > 0 && (
        <ul className="mb-3 space-y-2">
          {initial.map((m) => (
            <DefaultMealItem key={m.id} meal={m} />
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Meal name"
          aria-label="New default meal name"
          className="h-9 flex-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Input
          type="time"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          aria-label="New default meal time"
          className="h-9 w-28 tabular-nums"
        />
        <Button
          type="button"
          onClick={add}
          disabled={pending}
          aria-label="Add default meal"
          size="icon-lg"
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}

function DefaultMealItem({ meal }: { meal: DefaultMealRow }) {
  const router = useRouter();
  const [name, setName] = useState(meal.name);
  const [time, setTime] = useState(meal.timeHhmm);
  const [pending, startTransition] = useTransition();

  // Persist a field edit on blur, only when it actually changed. Snap back to
  // the saved value if the server rejects it (e.g. an emptied name).
  function save(next: { name: string; timeHhmm: string }) {
    if (next.name === meal.name && next.timeHhmm === meal.timeHhmm) return;
    startTransition(async () => {
      try {
        await updateDefaultMeal(meal.id, next);
        router.refresh();
      } catch {
        setName(meal.name);
        setTime(meal.timeHhmm);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteDefaultMeal(meal.id);
      router.refresh();
    });
  }

  return (
    <li className={cn("flex items-center gap-2", pending && "opacity-60")}>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => save({ name: name.trim(), timeHhmm: time })}
        aria-label="Meal name"
        className="h-9 flex-1 text-sm"
      />
      <Input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        onBlur={() => save({ name: name.trim(), timeHhmm: time })}
        aria-label="Meal time"
        className="h-9 w-28 tabular-nums"
      />
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label={`Remove ${meal.name}`}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
