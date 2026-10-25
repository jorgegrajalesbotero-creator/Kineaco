"use client";

import { X } from "lucide-react";
import { WEEK_DAYS } from "@/lib/dates";
import { SearchSelect } from "@/components/ui/Search";

export function DayRoutinesEditor({ days, routines, onChangeDay, savingDay, emptyLabel }) {
  const titleOf = (id) => routines.find((r) => r.id === id)?.title || "Rutina";
  const btn = "w-7 h-7 rounded-md text-soft flex items-center justify-center disabled:opacity-30 hover:text-accent";
  return (
    <div className="bg-card rounded-xl">
      {WEEK_DAYS.map((day) => {
        const list = days[day] || [];
        const move = (i, dir) => {
          const target = i + dir;
          if (target < 0 || target >= list.length) return;
          const copy = [...list];
          [copy[i], copy[target]] = [copy[target], copy[i]];
          onChangeDay(day, copy);
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
            <div className="space-y-1.5 mb-2">
              {list.map((rid, i) => (
                <div key={`${rid}-${i}`} className="flex items-center gap-1 bg-field rounded-lg pl-3 pr-1 py-1">
                  <span className="text-muted text-xs w-5 shrink-0">{i + 1}.</span>
                  <span className="flex-1 min-w-0 text-ink text-sm truncate">{titleOf(rid)}</span>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={btn} aria-label="Subir">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} className={btn} aria-label="Bajar">↓</button>
                  <button type="button" onClick={() => onChangeDay(day, list.filter((_, j) => j !== i))} className={`${btn} hover:text-danger`} aria-label="Quitar"><X size={14} /></button>
                </div>
              ))}
            </div>
            <SearchSelect
              options={routines.map((r) => ({ value: r.id, label: r.title || "Rutina", sub: [r.level, r.goal].filter(Boolean).join(" · ") }))}
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
