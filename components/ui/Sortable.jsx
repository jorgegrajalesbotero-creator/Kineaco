"use client";

// Ordenar arrastrando, igual en todo el panel:
//  · Computador: se arrastra con el mouse desde la agarradera ⋮⋮.
//  · Celular: se mantiene presionada la agarradera ⋮⋮ y se arrastra (así bajar la pantalla no mueve nada).
//  · Teclado: con la agarradera enfocada (Tab o un clic), las flechas ↑ ↓ mueven la fila.
import { forwardRef, useState } from "react";
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export { arrayMove };

export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );
}

// Claves estables para filas que no traen id propio (así no se pierde el foco al escribir y la animación sale bien).
// Se ajustan solas si la lista crece al final o se acorta; al mover, quitar o duplicar se avisa con move/remove/insert.
let keySeq = 0;
const newKey = () => `row-${++keySeq}`;
export function useListKeys(length) {
  const [keys, setKeys] = useState(() => Array.from({ length }, newKey));
  let current = keys;
  if (keys.length !== length) {
    current = keys.length < length ? [...keys, ...Array.from({ length: length - keys.length }, newKey)] : keys.slice(0, length);
    setKeys(current);
  }
  return {
    keys: current,
    move: (from, to) => setKeys((k) => arrayMove(k, from, to)),
    remove: (i) => setKeys((k) => k.filter((_, j) => j !== i)),
    insert: (i) => setKeys((k) => [...k.slice(0, i), newKey(), ...k.slice(i)]),
    removeMany: (set) => setKeys((k) => k.filter((_, j) => !set.has(j))),
  };
}

// Clave estable de un objeto mientras sea el mismo objeto (sirve para listas que se mueven sin editarse en línea)
const objKeys = new WeakMap();
export function keyOf(obj) {
  if (!obj || typeof obj !== "object") return String(obj);
  if (!objKeys.has(obj)) objKeys.set(obj, newKey());
  return objKeys.get(obj);
}

// Agarradera ⋮⋮. onKeyMove(dir) mueve con las flechas del teclado.
export const DragHandle = forwardRef(function DragHandle({ onKeyMove, className = "", label = "Mover (arrastre o use las flechas ↑ ↓)", ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      data-drag-handle
      aria-label={label}
      title={label}
      {...props}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          onKeyMove?.(e.key === "ArrowUp" ? -1 : 1);
          // La fila cambia de lugar: se mantiene el foco en su agarradera para seguir moviendo
          const el = e.currentTarget;
          requestAnimationFrame(() => { el.focus(); el.scrollIntoView({ block: "nearest" }); });
        }
        props.onKeyDown?.(e);
      }}
      className={`shrink-0 w-7 h-8 -ml-1 rounded-md flex items-center justify-center text-muted hover:text-ink focus-visible:text-accent focus-visible:ring-1 focus-visible:ring-accent outline-none cursor-grab active:cursor-grabbing touch-none select-none ${className}`}
    >
      <GripVertical size={15} />
    </button>
  );
});

// Una fila que se puede arrastrar. children(handleProps, { isDragging }) — handleProps va en <DragHandle {...handleProps} />
export function SortableRow({ id, data, children, className = "", disabled = false }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, data, disabled });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: "relative",
    zIndex: isDragging ? 30 : undefined,
  };
  const handleProps = { ref: setActivatorNodeRef, ...attributes, ...listeners, tabIndex: 0, role: "button" };
  return (
    <div ref={setNodeRef} style={style} className={`${className} ${isDragging ? "opacity-90 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)] ring-1 ring-accent/50 rounded-lg" : ""}`}>
      {children(handleProps, { isDragging })}
    </div>
  );
}

// Lista simple ordenable. ids: clave de cada fila (mismo orden que la lista). onMove(from, to).
export function SortableList({ ids, onMove, children, className = "" }) {
  const sensors = useDragSensors();
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from >= 0 && to >= 0) onMove(from, to);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  );
}
