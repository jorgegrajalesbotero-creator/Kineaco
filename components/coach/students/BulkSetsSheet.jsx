"use client";

import { useState } from "react";
import { Layers, X } from "lucide-react";
import { blockUsesProgression } from "@/lib/blocks";
import { cleanInt } from "@/lib/numbers";
import { useBackClose } from "@/lib/backStack";
import { saveSetsForAll } from "./exerciseEdits";

// Cambiar las series (y si quiere las reps) de TODOS los ejercicios del día a la vez, desde "Ver su rutina".
// Para uno solo, sigue estando «Editar» en cada ejercicio.
export function BulkSetsSheet({ student, routine, plan, planWeek, dayLabel, onClose, onSaved }) {
  const parts = routine?.parts || [routine];
  const [partIndex, setPartIndex] = useState(0);
  const [onlyMain, setOnlyMain] = useState(false);
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [scope, setScope] = useState("week");
  const [busy, setBusy] = useState(false);
  useBackClose(true, () => { if (!busy) onClose(); return !busy; });

  const part = parts[partIndex] || parts[0];
  const inPlan = !!(plan && planWeek && !part?.isExtra);
  const isPrivate = !!(part?.student_id && String(part.student_id) === String(student.id));
  const blockOf = (e) => (e.blockId ? (part?.blocks || []).find((b) => String(b.id) === String(e.blockId)) : null);
  const hasBlocks = (part?.blocks || []).length > 0;
  const list = (part?.exercises || []).filter((e) => !onlyMain || blockUsesProgression(blockOf(e)?.block_type || null));

  const field = "w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent";
  const chip = (on) => `flex-1 text-xs rounded-lg px-3 py-2 ${on ? "bg-accent text-app font-semibold" : "bg-field text-soft hover:text-ink"}`;

  const save = async () => {
    if (busy) return;
    if (!sets && !reps.trim()) return alert("Escriba las series (o las reps) para todos.");
    if (!list.length) return alert("No hay ejercicios para cambiar.");
    if (!inPlan && !isPrivate && !confirm("Para cambiar esto solo para este alumno se crea una copia de la rutina para él (la de la biblioteca no cambia). ¿Seguir?")) return;
    setBusy(true);
    try {
      await saveSetsForAll({ plan, planWeek, scope, part, exercises: list, sets, reps, studentId: student.id, dayLabel, isPrivate });
      await onSaved?.();
      onClose();
    } catch (e) {
      alert(e.message || "No se pudo guardar.");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[70]" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-label="Series de todos los ejercicios" className="bg-deep border border-white/[0.06] w-full max-w-md rounded-t-2xl md:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-accent text-xs font-semibold flex items-center gap-1.5"><Layers size={14} /> Series de todos los ejercicios</p>
            <h2 className="text-ink text-lg font-semibold leading-tight mt-1">{dayLabel}</h2>
            <p className="text-muted text-xs">{inPlan ? `Planeación · semana ${planWeek} de ${plan.weeks}` : part?.isExtra ? "Extra" : "Semana base (sin planeación)"}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted shrink-0"><X size={20} /></button>
        </div>

        {parts.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {parts.map((p, i) => (
              <button key={p.id || i} type="button" onClick={() => setPartIndex(i)} className={`text-xs rounded-full px-3 py-1.5 ${i === partIndex ? "bg-accent text-app font-semibold" : "bg-field text-soft"}`}>{p.title}</button>
            ))}
          </div>
        )}

        {inPlan && (
          <div className="mb-3">
            <p className="text-soft text-xs mb-1.5">¿Hasta cuándo vale el cambio?</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setScope("week")} className={chip(scope === "week")}>Solo esta semana</button>
              <button type="button" onClick={() => setScope("from")} className={chip(scope === "from")}>Desde esta semana en adelante</button>
            </div>
          </div>
        )}

        {hasBlocks && (
          <div className="flex gap-1.5 mb-3">
            <button type="button" onClick={() => setOnlyMain(false)} className={chip(!onlyMain)}>Todos los ejercicios</button>
            <button type="button" onClick={() => setOnlyMain(true)} className={chip(onlyMain)}>Solo trabajo principal</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-muted text-[11px]">Series para todos</span>
            <input autoFocus inputMode="numeric" value={sets} onChange={(e) => setSets(cleanInt(e.target.value).slice(0, 2))} placeholder="Ej: 4" className={field} />
          </label>
          <label className="block">
            <span className="text-muted text-[11px]">Reps (opcional)</span>
            <input value={reps} maxLength={20} onChange={(e) => setReps(e.target.value)} placeholder="Sin cambio" className={field} />
          </label>
        </div>
        <p className="text-muted text-[11px] mt-2">Se cambian {list.length} {list.length === 1 ? "ejercicio" : "ejercicios"}: {list.map((e) => e.name).join(", ") || "—"}.</p>
        {!inPlan && hasBlocks && <p className="text-muted text-[11px] mt-1">Sin planeación, las series son de cada bloque: se cambian los bloques de esos ejercicios.</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={save} disabled={busy || (!sets && !reps.trim())} className="flex-1 bg-accent text-app text-sm font-semibold rounded-xl py-2.5 disabled:opacity-50">
            {busy ? "Guardando..." : "Cambiar a todos"}
          </button>
          <button onClick={onClose} className="bg-field text-soft text-sm rounded-xl px-4 py-2.5">Cancelar</button>
        </div>
        {inPlan && <p className="text-muted text-[11px] mt-3">Se guarda en su planeación (la rutina original no cambia).</p>}
      </div>
    </div>
  );
}
