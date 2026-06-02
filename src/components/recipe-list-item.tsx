"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteRecipe } from "@/app/actions/recipes";
import { round1 } from "@/lib/utils";

export type RecipeListItemData = {
  id: number;
  name: string;
  ingredientCount: number;
  effectiveTotalWeightG: number;
  weightIsDerived: boolean;
  servings: number | null;
  per100Kcal: number;
  /** Set when this is a friend's recipe — read-only (add-to-meal only). */
  ownerName?: string | null;
};

export function RecipeListItem({ recipe }: { recipe: RecipeListItemData }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isFriend = !!recipe.ownerName;

  const meta = (
    <p className="mt-0.5 truncate text-xs text-muted-foreground">
      {isFriend && <>{recipe.ownerName} · </>}
      {recipe.ingredientCount}{" "}
      {recipe.ingredientCount === 1 ? "ingredient" : "ingredients"}
      {recipe.effectiveTotalWeightG > 0 && (
        <>
          {" · "}
          {Math.round(recipe.effectiveTotalWeightG)}g
          {recipe.weightIsDerived ? " (sum)" : " total"}
        </>
      )}
      {recipe.servings != null && <> · {formatServings(recipe.servings)}</>}
    </p>
  );

  const stats = (
    <div className="shrink-0 text-right">
      <div className="text-sm font-semibold tabular-nums">
        {Math.round(recipe.per100Kcal)}
      </div>
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        kcal/100g
      </div>
    </div>
  );

  // A friend's recipe can't be edited or deleted — the whole row is a
  // single "add to meal" link, no options menu.
  if (isFriend) {
    return (
      <li className="group flex items-stretch rounded-2xl border border-border/60 bg-card transition-all hover:border-border hover:shadow-sm">
        <AppLink
          href={`/add?recipeId=${recipe.id}`}
          className="flex min-w-0 flex-1 items-center justify-between p-4"
        >
          <div className="min-w-0 flex-1 pr-4">
            <p className="truncate text-sm font-medium">{recipe.name}</p>
            {meta}
          </div>
          {stats}
        </AppLink>
      </li>
    );
  }

  return (
    <li className="group flex items-stretch rounded-2xl border border-border/60 bg-card transition-all hover:border-border hover:shadow-sm">
      <AppLink
        href={`/recipes/${recipe.id}`}
        className="flex min-w-0 flex-1 items-center justify-between p-4"
      >
        <div className="min-w-0 flex-1 pr-4">
          <p className="truncate text-sm font-medium">{recipe.name}</p>
          {meta}
        </div>
        {stats}
      </AppLink>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Recipe options"
          className="inline-flex w-9 shrink-0 items-center justify-center rounded-r-2xl text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-expanded:bg-muted"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <AppLink
                  href={`/add?recipeId=${recipe.id}`}
                  className="cursor-pointer rounded-lg text-sm"
                />
              }
            >
              <Plus className="mr-2 h-3.5 w-3.5 opacity-70" />
              Add to meal
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <AppLink
                  href={`/recipes/${recipe.id}`}
                  className="cursor-pointer rounded-lg text-sm"
                />
              }
            >
              <Pencil className="mr-2 h-3.5 w-3.5 opacity-70" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer rounded-lg text-sm"
              // setTimeout 0 defers the dialog open until after Base UI
              // has finished closing the menu + restoring focus. Without
              // it the dialog mount loses to the focus race and never
              // appears. Same pattern as weight-card's import dialog.
              onClick={() => setTimeout(() => setDeleteOpen(true), 0)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDialog
        open={deleteOpen}
        recipeId={recipe.id}
        recipeName={recipe.name}
        onClose={() => setDeleteOpen(false)}
      />
    </li>
  );
}

function DeleteDialog({
  open,
  recipeId,
  recipeName,
  onClose,
}: {
  open: boolean;
  recipeId: number;
  recipeName: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onConfirm() {
    startTransition(async () => {
      try {
        await deleteRecipe(recipeId);
        router.refresh();
        onClose();
      } catch (err) {
        console.error(err);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogTitle className="text-base font-semibold">
          Delete {recipeName}?
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Old diary rows logged from this recipe stay put — only the recipe
          itself is removed.
        </DialogDescription>
        <div className="mt-4 flex gap-2">
          <DialogClose
            render={<Button variant="ghost" className="flex-1 rounded-full" />}
          >
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
            className="flex-1 rounded-full"
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatServings(n: number): string {
  const rounded = round1(n);
  if (rounded === 1) return "1 serving";
  return `${rounded} servings`;
}
