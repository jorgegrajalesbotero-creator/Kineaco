"use client";

import { useState } from "react";
import { Layers, X } from "lucide-react";
import { blockTypeLabel } from "@/lib/blocks";
import { cleanInt } from "@/lib/numbers";
import { useBackClose } from "@/lib/backStack";
import { InfoTip } from "@/components/ui/InfoTip";
import { saveSetsForAll } from "./exerciseEdits";

// Series (y si quiere las reps) de UN bloque, desde "Rutina como la ve el alumno": se abre tocando
// "Serie 1 de 3" en el bloque. exercises = los ejercicios de ese bloque.
export function BlockSetsSheet({ student, part, block, exercises, plan, planWeek, dayLabel, onClose, onSaved }) {
  const current = block?.sets ? String(block.sets) : exercises[0]?.setsCount ? String(exercises[0].setsCount) : "";
  const [sets, setSets] = useState(current);
  const [reps, setReps] = useState("");
  const [scope, setScope] = useState("week");
  const [busy, setBusy] = useState(false);
  useBackClose(true, () => { if (!busy) onClose(); return !busy; });

  const inPlan = !!(plan && planWeek && !part?.isExtra);
  const isPrivate = !!(part?.student_id && String(part.student_id) === String(student.id));
  const field = "w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent";
  const chip = (on) => `flex-1 text-xs rounded-lg px-3 py-2 ${on ? "bg-accent text-app font-semibold" : "bg-field text-soft hover:text-ink"}`;
  const changedSets = sets && sets !== current;

  const save = async () => {
    if (busy) return;
    if (!changedSets && !reps.trim()) return onClose();
    setBusy(true);
    try {
      await saveSetsForAll({ plan, planWeek, scope, part, exercises, sets: changedSets ? sets : "", reps, studentId: student.id, dayLabel, isPrivate });
      await onSaved?.();
      onClose();
    } catch (e) {
      alert(e.message || "No se pudo guardar.");
    }
    setBusy(false);
  };

  const name = block?.title || blockTypeLabel(block?.block_type) || "Bloque";
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[70]" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-label={`Series de ${name}`} className="bg-deep border border-white/[0.06] w-full max-w-md rounded-t-2xl md:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-accent text-xs font-semibold flex items-center gap-1.5"><Layers size={14} /> Series del bloque</p>
            <h2 className="text-ink text-lg font-semibold leading-tight mt-1">{name}</h2>
            <p className="text-muted text-xs flex items-center gap-1.5">
              {inPlan ? `Planeación · semana ${planWeek}` : part?.isExtra ? "Extra" : "Semana base"}
              <InfoTip text={`Cambia ${exercises.length} ${exercises.length === 1 ? "ejercicio" : "ejercicios"}: ${exercises.map((e) => e.name).join(", ")}.${inPlan ? " Se guarda en su planeación; la rutina original no cambia." : " Solo para este alumno; la rutina de la biblioteca no cambia."}`} />
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted shrink-0"><X size={20} /></button>
        </div>

        {inPlan && (
          <div className="flex gap-1.5 mb-3">
            <button type="button" onClick={() => setScope("week")} className={chip(scope === "week")}>Solo esta semana</button>
            <button type="button" onClick={() => setScope("from")} className={chip(scope === "from")}>Desde esta semana</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-muted text-[11px]">Series</span>
            <input autoFocus inputMode="numeric" value={sets} onChange={(e) => setSets(cleanInt(e.target.value).slice(0, 2))} placeholder="Ej: 4" className={field} />
          </label>
          <label className="block">
            <span className="text-muted text-[11px]">Reps (opcional)</span>
            <input value={reps} maxLength={20} onChange={(e) => setReps(e.target.value)} placeholder="Sin cambio" className={field} />
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={save} disabled={busy} className="flex-1 bg-accent text-app text-sm font-semibold rounded-xl py-2.5 disabled:opacity-50">
            {busy ? "Guardando..." : "Guardar"}
          </button>
          <button onClick={onClose} className="bg-field text-soft text-sm rounded-xl px-4 py-2.5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
