"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import clsx from "clsx";
import { moveCourse } from "@/lib/course-order";

type CourseLike = { id: string };
type SortControls = {
  handleProps: {
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
  };
  isDragging: boolean;
  moveUp: () => void;
  moveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export function SortableCourseList<T extends CourseLike>({ items, onReorder, renderItem, className }: {
  items: readonly T[];
  onReorder: (orderedIds: string[]) => Promise<void>;
  renderItem: (item: T, index: number, controls: SortControls) => React.ReactNode;
  className?: string;
}) {
  const [orderedIds, setOrderedIds] = useState(() => items.map((item) => item.id));
  const [draggingId, setDraggingId] = useState("");
  const [dragStartIds, setDragStartIds] = useState<string[]>(orderedIds);
  const incomingIds = items.map((item) => item.id);
  const hasSameItems = incomingIds.length === orderedIds.length && incomingIds.every((id) => orderedIds.includes(id));
  const displayIds = hasSameItems ? orderedIds : incomingIds;
  const ordered = displayIds.map((id) => items.find((item) => item.id === id)).filter((item): item is T => Boolean(item));

  const commit = async (nextIds: string[], fallbackIds: string[]) => {
    setOrderedIds(nextIds);
    try { await onReorder(nextIds); }
    catch { setOrderedIds(fallbackIds); }
  };

  const move = (activeId: string, overId: string) => {
    setOrderedIds((current) => moveCourse(current.map((id) => ({ id })), activeId, overId).map((item) => item.id));
  };

  return <div className={className}>{ordered.map((item, index) => {
    const finish = (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!draggingId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      setDraggingId(""); void commit(displayIds, dragStartIds);
    };
    const controls: SortControls = {
      isDragging: draggingId === item.id,
      canMoveUp: index > 0,
      canMoveDown: index < ordered.length - 1,
      moveUp: () => { if (index < 1) return; const next = moveCourse(ordered, item.id, ordered[index - 1].id).map((course) => course.id); void commit(next, displayIds); },
      moveDown: () => { if (index >= ordered.length - 1) return; const next = moveCourse(ordered, item.id, ordered[index + 1].id).map((course) => course.id); void commit(next, displayIds); },
      handleProps: {
        onPointerDown: (event) => { event.preventDefault(); setDragStartIds(displayIds); setDraggingId(item.id); event.currentTarget.setPointerCapture(event.pointerId); },
        onPointerMove: (event) => { if (draggingId !== item.id) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-course-sort-id]"); const overId = target?.dataset.courseSortId; if (overId) move(item.id, overId); },
        onPointerUp: finish,
        onPointerCancel: finish,
      },
    };
    return <div key={item.id} data-course-sort-id={item.id} className={clsx("relative", controls.isDragging && "z-10 opacity-70")}>{renderItem(item, index, controls)}</div>;
  })}</div>;
}

export function CourseOrderControls({ controls, label }: { controls: SortControls; label: string }) {
  return <div className="flex shrink-0 items-center gap-1">
    <button type="button" {...controls.handleProps} aria-label={`Drag ${label} to reorder`} className="focus-ring cursor-grab touch-none rounded-full p-2 text-[var(--muted)] active:cursor-grabbing"><GripVertical size={18} /></button>
    <span className="flex sm:hidden">
      <button type="button" disabled={!controls.canMoveUp} onClick={controls.moveUp} aria-label={`Move ${label} up`} className="focus-ring rounded-full p-2 text-[var(--muted)] disabled:opacity-25"><ArrowUp size={16} /></button>
      <button type="button" disabled={!controls.canMoveDown} onClick={controls.moveDown} aria-label={`Move ${label} down`} className="focus-ring rounded-full p-2 text-[var(--muted)] disabled:opacity-25"><ArrowDown size={16} /></button>
    </span>
  </div>;
}
