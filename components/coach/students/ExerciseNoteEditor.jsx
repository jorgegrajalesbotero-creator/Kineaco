"use client";

import { useState } from "react";
import { MessageSquareText, Trash2, X } from "lucide-react";
import { NOTE_MAX } from "@/lib/exerciseNotes";

// Ventana para escribir la observación de un ejercicio para UN alumno.
// onSave(texto) guarda (texto vacío = borrar) y devuelve true si salió bien.
export function ExerciseNoteEditor({ exerciseName, routineTitle, initial = "", onSave, onClose }) {
  const [text, setText] = useState(initial || "");
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
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <p className="text-accent text-xs font-semibold flex items-center gap-1.5"><MessageSquareText size={14} /> Observación para el alumno</p>
            <h2 className="text-ink text-lg font-semibold leading-tight mt-1">{exerciseName}</h2>
            {routineTitle && <p className="text-muted text-xs truncate">{routineTitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted shrink-0"><X size={20} /></button>
        </div>
        <textarea
          autoFocus
          value={text}
          maxLength={NOTE_MAX}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Ej: baje controlado en 3 segundos, cuide la rodilla izquierda, suba 2,5 kg si le sobran reps..."
          className="w-full mt-3 bg-field text-ink text-[15px] rounded-xl px-3.5 py-3 outline-none focus:ring-1 focus:ring-accent resize-y"
        />
        <div className="flex items-center justify-between mt-1 mb-3">
          <p className="text-muted text-[11px]">Solo la ve este alumno, vale todas las semanas y no cambia la rutina ni la planeación.</p>
          <span className="text-muted text-[11px] tabular-nums shrink-0 ml-2">{text.length}/{NOTE_MAX}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => save(text)} disabled={busy || (!text.trim() && !initial)} className="flex-1 bg-accent text-app text-sm font-semibold rounded-xl py-2.5 disabled:opacity-50">
            {busy ? "Guardando..." : "Guardar"}
          </button>
          {initial && (
            <button onClick={() => { if (confirm("¿Borrar esta observación?")) save(""); }} disabled={busy} className="bg-field text-soft text-sm rounded-xl px-3.5 py-2.5 flex items-center gap-1.5 hover:text-danger disabled:opacity-50">
              <Trash2 size={14} /> Borrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
