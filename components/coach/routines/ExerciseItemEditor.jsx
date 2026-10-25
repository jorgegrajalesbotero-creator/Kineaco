"use client";

import { useState } from "react";
import { catalogOptions } from "@/components/coach/routines/routineHelpers";
import { SearchSelect } from "@/components/ui/Search";

// Edita un ejercicio que ya está en la rutina: cambiarlo por otro del catálogo, series (solo en lista), reps, peso y descanso
export function ExerciseItemEditor({ item, catalog, showSets = false, onSave, onCancel }) {
  const [f, setF] = useState({
    exerciseId: item.exerciseId,
    sets: item.sets && item.sets !== "0" ? item.sets : "",
    reps: item.reps || "",
    targetWeight: item.targetWeight || "",
    restMinutes: item.restMinutes || "",
  });
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const inputCls = "bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none min-w-0 w-full";

  const save = () => {
    const chosen = catalog.find((c) => c.id === f.exerciseId);
    const patch = {
      exerciseId: f.exerciseId,
      name: chosen?.name || item.name,
      reps: f.reps.trim(),
      targetWeight: f.targetWeight.trim().replace(",", "."),
      restMinutes: f.restMinutes.trim().replace(",", "."),
    };
    if (showSets) patch.sets = f.sets.trim();
    onSave(patch);
  };

  return (
    <div className="bg-field/60 rounded-lg p-3 space-y-2 ring-1 ring-accent/40">
      <SearchSelect options={catalogOptions(catalog)} value={f.exerciseId} onChange={(id) => id && set({ exerciseId: id })} placeholder="Cambiar ejercicio..." />
      <div className={`grid gap-2 ${showSets ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
        {showSets && (
          <label className="block">
            <span className="text-muted text-[11px]">Series</span>
            <input inputMode="numeric" value={f.sets} onChange={(e) => set({ sets: e.target.value.replace(/\D/g, "") })} className={inputCls} />
          </label>
        )}
        <label className="block">
          <span className="text-muted text-[11px]">Reps</span>
          <input value={f.reps} onChange={(e) => set({ reps: e.target.value })} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-muted text-[11px]">Peso (kg)</span>
          <input inputMode="decimal" value={f.targetWeight} onChange={(e) => set({ targetWeight: e.target.value.replace(/[^\d.,]/g, "") })} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-muted text-[11px]">Descanso (min)</span>
          <input inputMode="decimal" value={f.restMinutes} onChange={(e) => set({ restMinutes: e.target.value.replace(/[^\d.,]/g, "") })} className={inputCls} />
        </label>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-muted text-xs px-3 py-1.5">Cancelar</button>
        <button type="button" onClick={save} className="bg-accent text-app text-xs font-semibold px-3 py-1.5 rounded-lg">Listo</button>
      </div>
    </div>
  );
}
