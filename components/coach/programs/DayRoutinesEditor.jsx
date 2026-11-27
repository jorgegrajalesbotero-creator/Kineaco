"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { RoutinePeek } from "@/components/coach/programs/RoutinePeek";
import { WEEK_DAYS } from "@/lib/dates";
import { SearchSelect } from "@/components/ui/Search";
import { DragHandle, SortableList, SortableRow, arrayMove } from "@/components/ui/Sortable";
import { useUndo } from "@/components/ui/UndoToast";

// Clave de cada rutina del día (la misma rutina puede estar dos veces)
const rowIds = (list) => { const seen = {}; return list.map((rid) => { seen[rid] = (seen[rid] || 0) + 1; return `${rid}#${seen[rid]}`; }); };

export function DayRoutinesEditor({ days, routines, onChangeDay, savingDay, emptyLabel }) {
  // Las versiones anteriores de una rutina (archivadas) se muestran con su nombre, pero no se pueden elegir de nuevo
  const titleOf = (id) => {
    const r = routines.find((x) => x.id === id);
    return r ? `${r.title || "Rutina"}${r.archived_at ? " (versión anterior)" : ""}` : "Rutina";
  };
  const btn = "w-7 h-7 rounded-md text-soft flex items-center justify-center disabled:opacity-30 hover:text-accent";
  const { offer, toast } = useUndo();
  const [open, setOpen] = useState({}); // rutinas desplegadas para ver sus ejercicios (por día y fila)
  const toggle = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  return (
    <div className="bg-card rounded-xl">
      {toast}
      {WEEK_DAYS.map((day) => {
        const list = days[day] || [];
        const ids = rowIds(list);
        const moveTo = (from, to) => { if (to >= 0 && to < list.length && from !== to) onChangeDay(day, arrayMove(list, from, to)); };
        const remove = (i) => {
          onChangeDay(day, list.filter((_, j) => j !== i));
          offer(`Se quitó «${titleOf(list[i])}» del ${day.toLowerCase()}`, () => onChangeDay(day, list));
        };
        return (
          <div key={day} className="px-4 py-3 border-b border-field last:border-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-ink text-sm font-medium">{day}</span>
              {savingDay === day ? (
                <span className="text-muted text-xs">Guardando...</span>
              ) : list.length === 0 ? (
                <span className="text-muted text-xs">{emptyLabel}</span>
              ) : (
                <span className="text-muted text-xs">{list.length} {list.length === 1 ? "rutina" : "rutinas"}</span>
              )}
            </div>
            <SortableList ids={ids} onMove={moveTo} className="space-y-1.5 mb-2">
              {list.map((rid, i) => (
                <SortableRow key={ids[i]} id={ids[i]} disabled={savingDay === day}>{(handle) => (
                <div className="bg-field rounded-lg">
                <div className="flex items-center gap-1 pl-2 pr-1 py-1">
                  {list.length > 1 && <DragHandle {...handle} onKeyMove={(dir) => moveTo(i, i + dir)} label="Mover rutina (arrastre o use las flechas ↑ ↓)" />}
                  <span className="text-muted text-xs w-5 shrink-0">{i + 1}.</span>
                  {/* Tocar el nombre despliega sus ejercicios, para saber qué rutina se le está poniendo */}
                  <button type="button" onClick={() => toggle(`${day}|${ids[i]}`)} aria-expanded={!!open[`${day}|${ids[i]}`]} title="Ver los ejercicios de esta rutina"
                    className="flex-1 min-w-0 flex items-center gap-1 text-left text-ink text-sm hover:text-accent">
                    {open[`${day}|${ids[i]}`] ? <ChevronDown size={14} className="shrink-0 text-accent" /> : <ChevronRight size={14} className="shrink-0 text-muted" />}
                    <span className="truncate">{titleOf(rid)}</span>
                  </button>
                  <button type="button" onClick={() => remove(i)} className={`${btn} hover:text-danger`} aria-label="Quitar"><X size={14} /></button>
                </div>
                {open[`${day}|${ids[i]}`] && <RoutinePeek routineId={rid} />}
                </div>
                )}</SortableRow>
              ))}
            </SortableList>
            <SearchSelect
              options={routines.filter((r) => !r.archived_at).map((r) => ({ value: r.id, label: r.title || "Rutina", sub: [r.level, r.goal].filter(Boolean).join(" · ") }))}
              value=""
              keepEmpty
              onChange={(id) => { if (id) onChangeDay(day, [...list, id]); }}
              disabled={savingDay === day}
              placeholder="+ Agregar rutina a este día (buscar)..."
              inputClassName="!bg-app border border-dashed border-field placeholder:text-accent text-xs"
            />
          </div>
        );
      })}
    </div>
  );
}
