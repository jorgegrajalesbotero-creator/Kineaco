"use client";

import { useState } from "react";
import { Timer, X } from "lucide-react";
import { normalizeTimer, timerLabel } from "@/lib/clock";
import { TimerSettings } from "@/components/coach/TimerSettings";

// Ventana para programar el reloj de un bloque SOLO para un alumno.
// base = reloj de la rutina (si tiene). onSave(timer | null) devuelve true si salió bien (null = volver al de la rutina).
export function TimerOverrideEditor({ blockTitle, routineTitle, initial, base, isCustom, onSave, onClose }) {
  const [timer, setTimer] = useState(normalizeTimer(initial));
  const [busy, setBusy] = useState(false);

  const save = async (value) => {
    setBusy(true);
    const ok = await onSave(value);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[70]" onClick={onClose}>
      <div className="bg-deep border border-white/[0.06] w-full max-w-md rounded-t-2xl md:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-accent text-xs font-semibold flex items-center gap-1.5"><Timer size={14} /> Reloj solo para este alumno</p>
            <h2 className="text-ink text-lg font-semibold leading-tight mt-1">{blockTitle}</h2>
            {routineTitle && <p className="text-muted text-xs truncate">{routineTitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted shrink-0"><X size={20} /></button>
        </div>
        <p className="text-muted text-xs mb-3">
          {base ? `La rutina tiene programado: ${timerLabel(base)}. Lo que guarde acá vale solo para este alumno.` : "La rutina no tiene reloj programado. Lo que guarde acá vale solo para este alumno."}
          {" "}El alumno lo abre con un toque y lo puede ajustar.
        </p>
        <TimerSettings value={timer} onChange={setTimer} />
        <div className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
          {isCustom && (
            <button onClick={() => save(null)} disabled={busy} className="sm:flex-1 bg-field text-soft text-sm rounded-xl py-3 disabled:opacity-60">
              {base ? "Volver al de la rutina" : "Quitar reloj"}
            </button>
          )}
          <button onClick={() => save(timer)} disabled={busy || !timer} className="sm:flex-1 bg-accent text-app font-semibold text-sm rounded-xl py-3 disabled:opacity-50">
            {busy ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
