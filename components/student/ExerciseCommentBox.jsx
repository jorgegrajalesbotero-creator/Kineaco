"use client";

import { useState } from "react";
import { MessageCircle, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { tr } from "@/lib/i18n";
import { localDateString } from "@/lib/dates";
import { mondayOf } from "@/lib/trainingPlan";
import { COMMENT_MAX, saveExerciseComment } from "@/lib/exerciseComments";

// El alumno le deja un comentario a su coach sobre este ejercicio (le llega un aviso).
// weekDate = cualquier fecha de la semana que se está viendo (por defecto, hoy).
export function ExerciseCommentBox({ exercise, routineId, dayLabel, userId, value = "", onSaved, weekDate = new Date() }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);

  const save = async (next) => {
    setBusy(true);
    const { error } = await saveExerciseComment(supabase, {
      userId, routineId, itemKey: exercise.itemKey || null, exerciseId: exercise.exerciseId,
      weekStart: localDateString(mondayOf(weekDate)), dayLabel, comment: next,
    });
    setBusy(false);
    if (error) return alert(tr("No se pudo guardar el comentario."));
    onSaved?.(next.trim());
    setOpen(false);
  };

  if (!open) {
    return value ? (
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5 mb-4">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-soft text-[11px] font-semibold flex items-center gap-1.5"><MessageCircle size={13} /> {tr("Su comentario para el coach")}</p>
          <button onClick={() => { setText(value); setOpen(true); }} className="text-soft text-[11px] flex items-center gap-1 hover:text-ink"><Pencil size={11} /> {tr("Editar")}</button>
        </div>
        <p className="text-ink text-sm whitespace-pre-wrap break-words">{value}</p>
      </div>
    ) : (
      <button onClick={() => { setText(""); setOpen(true); }} className="w-full mb-4 flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.06] text-soft text-sm rounded-xl py-2.5">
        <MessageCircle size={14} /> {tr("Dejarle un comentario a su coach")}
      </button>
    );
  }

  return (
    <div className="mb-4">
      <textarea
        autoFocus
        value={text}
        maxLength={COMMENT_MAX}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={tr("Ej: sentí la rodilla en la bajada, la máquina estaba ocupada y lo hice con mancuernas...")}
        className="w-full bg-app/60 border border-white/[0.07] text-ink text-[15px] rounded-xl px-3 py-2.5 outline-none focus:border-accent/50 resize-y"
      />
      <div className="flex gap-2 mt-2">
        <button onClick={() => save(text)} disabled={busy || (!text.trim() && !value)} className="flex-1 bg-accent text-app text-sm font-semibold rounded-xl py-2.5 disabled:opacity-50">
          {busy ? tr("Guardando...") : tr("Enviar a su coach")}
        </button>
        {value && (
          <button onClick={() => save("")} disabled={busy} className="bg-white/[0.04] text-soft text-sm rounded-xl px-3.5 py-2.5">{tr("Borrar")}</button>
        )}
        <button onClick={() => setOpen(false)} disabled={busy} className="bg-white/[0.04] text-soft text-sm rounded-xl px-3.5 py-2.5">{tr("Cancelar")}</button>
      </div>
    </div>
  );
}
