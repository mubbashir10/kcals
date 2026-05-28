"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import { setWidgetOrder } from "@/app/actions/widgets";
import type { ReorderableWidgetId } from "@/lib/widget-order";

export type SortableWidgetItem = {
  id: ReorderableWidgetId;
  node: React.ReactNode;
};

export function SortableWidgets({
  initialOrder,
  items,
}: {
  initialOrder: ReorderableWidgetId[];
  items: SortableWidgetItem[];
}) {
  const itemMap = new Map(items.map((it) => [it.id, it.node]));
  const visibleIds = initialOrder.filter((id) => itemMap.has(id));

  const [order, setOrder] = useState<ReorderableWidgetId[]>(visibleIds);
  const [activeId, setActiveId] = useState<ReorderableWidgetId | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    // No delay on pointer — the explicit drag handle is the activation.
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    // Small delay on touch so vertical scrolling on the handle still works.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as ReorderableWidgetId);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(active.id as ReorderableWidgetId);
    const newIndex = order.indexOf(over.id as ReorderableWidgetId);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);

    // Persist — preserve hidden widgets' positions in the saved order.
    const visibleSet = new Set(next);
    const allInOrder: ReorderableWidgetId[] = [];
    let visibleIdx = 0;
    for (const id of initialOrder) {
      if (visibleSet.has(id)) {
        allInOrder.push(next[visibleIdx++]);
      } else {
        allInOrder.push(id);
      }
    }
    startTransition(async () => {
      await setWidgetOrder(allInOrder);
    });
  }

  return (
    <DndContext
      id="kcals-widget-sort"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {order.map((id) => {
            const node = itemMap.get(id);
            if (!node) return null;
            return (
              <SortableItem
                key={id}
                id={id}
                anyDragging={!!activeId}
              >
                {node}
              </SortableItem>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({
  id,
  anyDragging,
  children,
}: {
  id: ReorderableWidgetId;
  anyDragging: boolean;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    // No transition on the actively-dragged item — it should follow the
    // pointer 1:1, not animate behind it (which causes the smeared look).
    transition: isDragging ? "none" : transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative",
        // Active item: highlight with a brand-colored outline so it
        // reads as "this is the one I'm moving" without needing
        // transforms/shadows that mangle the content.
        isDragging &&
          "z-10 rounded-3xl ring-2 ring-emerald-400/70 ring-offset-4 ring-offset-background",
        // Siblings stay still — no blur, just slightly dimmed so they
        // recede.
        anyDragging &&
          !isDragging &&
          "opacity-50 transition-opacity duration-150"
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className={cn(
          "absolute -left-7 top-1/2 z-20 -translate-y-1/2",
          "inline-flex h-8 w-6 items-center justify-center rounded",
          "touch-none cursor-grab active:cursor-grabbing",
          "text-muted-foreground/25 transition-all",
          "hover:bg-muted hover:text-foreground",
          "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          // Show the handle only when the row (or handle) is hovered/focused
          // — keeps the layout clean. Always visible during a drag.
          "opacity-0 group-hover:opacity-100",
          isDragging && "cursor-grabbing opacity-100 text-foreground"
        )}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}
