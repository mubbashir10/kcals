"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import {
  CustomFoodDialog,
  type EditableCustomFood,
} from "@/components/custom-food-dialog";
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
import { deleteCustomFood } from "@/app/actions/custom-foods";

export type CustomFoodListItemData = EditableCustomFood & {
  source: "USER" | "AI";
};

export function CustomFoodListItem({ food }: { food: CustomFoodListItemData }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isAi = food.source === "AI";

  return (
    <li className="group flex items-stretch rounded-2xl border border-border/60 bg-card transition-all hover:border-border hover:shadow-sm">
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="flex min-w-0 flex-1 items-center justify-between p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <div className="min-w-0 flex-1 pr-4">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {isAi && (
              <Sparkles className="h-3 w-3 shrink-0 text-foreground/60" />
            )}
            <span className="truncate">{food.name}</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {food.brand ? `${food.brand} · ` : ""}
            {isAi ? "AI estimate" : "Custom"}
            {food.servingLabel ? ` · ${food.servingLabel}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums">
            {Math.round(food.kcal)}
          </div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            kcal/100g
          </div>
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Food options"
          className="inline-flex w-9 shrink-0 items-center justify-center rounded-r-2xl text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-expanded:bg-muted"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <AppLink
                  href={`/add?customFoodId=${food.id}`}
                  className="cursor-pointer rounded-lg text-sm"
                />
              }
            >
              <Plus className="mr-2 h-3.5 w-3.5 opacity-70" />
              Add to meal
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-lg text-sm"
              // setTimeout 0 defers the dialog open until Base UI finishes
              // closing the menu + restoring focus — otherwise the dialog
              // mount loses the race and never appears.
              onClick={() => setTimeout(() => setEditOpen(true), 0)}
            >
              <Pencil className="mr-2 h-3.5 w-3.5 opacity-70" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer rounded-lg text-sm"
              onClick={() => setTimeout(() => setDeleteOpen(true), 0)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <CustomFoodDialog open={editOpen} onOpenChange={setEditOpen} editing={food} />
      <DeleteDialog
        open={deleteOpen}
        food={food}
        onClose={() => setDeleteOpen(false)}
      />
    </li>
  );
}

function DeleteDialog({
  open,
  food,
  onClose,
}: {
  open: boolean;
  food: CustomFoodListItemData;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onConfirm() {
    startTransition(async () => {
      try {
        await deleteCustomFood(food.id);
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
          Delete {food.name}?
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Old diary rows logged from this food stay put — only the saved food
          is removed. It also disappears from search for everyone.
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
