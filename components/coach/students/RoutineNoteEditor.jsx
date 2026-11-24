"use client";

import { useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { ROUTINE_NOTE_MAX } from "@/lib/routineNotes";
import { useBackClose } from "@/lib/backStack";

// Ventana para escribir un comentario SOLO para un alumno: el de un bloque o el del día entero.
// base = lo que trae la rutina (si tiene). onSave(texto) devuelve true si salió bien;
// con el texto vacío se borra el comentario del alumno y vuelve el de la rutina.
export function RoutineNoteEditor({ title, routineTitle, initial = "", base = "", isCustom = false, onSave, onClose }) {
  useBackClose(true, onClose); // "atrás" del celular cierra esta ventana (no la pantalla de atrás)
  const [text, setText] = useState(initial);
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
            <p className="text-accent text-xs font-semibold flex items-center gap-1.5"><MessageSquare size={14} /> Comentario solo para este alumno</p>
            <h2 className="text-ink text-lg font-semibold leading-tight mt-1">{title}</h2>
            {routineTitle && <p className="text-muted text-xs truncate">{routineTitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted shrink-0"><X size={20} /></button>
        </div>

        {base && (
          <div className="bg-field/60 rounded-xl px-3 py-2 mb-3">
            <p className="text-muted text-[11px] mb-0.5">La rutina dice:</p>
            <p className="text-soft text-xs leading-snug whitespace-pre-wrap">{base}</p>
          </div>
        )}
        <p className="text-muted text-xs mb-3">
          {base ? "Lo que escriba acá reemplaza ese texto, solo para este alumno." : "Lo que escriba acá lo ve solo este alumno."}
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, ROUTINE_NOTE_MAX))}
          maxLength={ROUTINE_NOTE_MAX}
          rows={4}
          autoFocus
          placeholder="Por ejemplo: hoy baje el ritmo y cuide la técnica."
          className="w-full bg-field text-ink text-sm rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-muted"
        />
        <p className="text-muted text-[11px] text-right mt-1 tabular-nums">{text.length}/{ROUTINE_NOTE_MAX}</p>

        <div className="flex flex-col-reverse sm:flex-row gap-2 mt-3">
          {isCustom && (
            <button onClick={() => save("")} disabled={busy} className="sm:flex-1 bg-field text-soft text-sm rounded-xl py-3 disabled:opacity-60">
              {base ? "Volver al de la rutina" : "Quitar comentario"}
            </button>
          )}
          <button onClick={() => save(text)} disabled={busy} className="sm:flex-1 bg-accent text-app font-semibold text-sm rounded-xl py-3 disabled:opacity-50">
            {busy ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
