"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { tr } from "@/lib/i18n";
import { ISSUE_KINDS, ISSUE_SIDES, ISSUE_TIMES, ISSUE_ZONES, saveCheckout } from "@/lib/checkout";

const keyOf = (e) => `${e.routineId || ""}|${e.itemKey || ""}|${e.exerciseId}`;

// Check-out opcional al terminar: esfuerzo, molestias por ejercicio (zona, lado, tipo, intensidad, cuándo) y comentario.
// initial = check-out ya guardado (para editarlo). exercises = ejercicios del día.
export function CheckoutSheet({ userId, weekStart, dayLabel, exercises, initial = null, onClose, onSaved }) {
  const [effort, setEffort] = useState(initial?.effort || null);
  const [hadIssue, setHadIssue] = useState(initial ? !!initial.had_issue : null);
  const [issues, setIssues] = useState(() => {
    const map = {};
    (initial?.issues || []).forEach((i) => {
      const ex = exercises.find((e) => String(e.exerciseId) === String(i.exercise_id) && String(e.itemKey || "") === String(i.item_key || ""));
      map[ex ? keyOf(ex) : `x|${i.name}`] = { ...i };
    });
    return map;
  });
  const [comment, setComment] = useState(initial?.comment || "");
  const [busy, setBusy] = useState(false);

  // Un ejercicio aparece una sola vez aunque esté en dos bloques
  const list = [];
  const seen = new Set();
  exercises.forEach((e) => { const k = keyOf(e); if (!seen.has(k)) { seen.add(k); list.push(e); } });

  const toggleEx = (e) => setIssues((m) => {
    const k = keyOf(e);
    const copy = { ...m };
    if (copy[k]) delete copy[k];
    else copy[k] = { exercise_id: e.exerciseId, item_key: e.itemKey || null, routine_id: e.routineId || null, name: e.name, zone: null, side: null, kind: null, intensity: null, when: null, note: "" };
    return copy;
  });
  const setIssue = (k, patch) => setIssues((m) => ({ ...m, [k]: { ...m[k], ...patch } }));

  const chips = (options, value, onPick, small = false) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onPick(value === o.key ? null : o.key)}
          className={`rounded-full px-3 ${small ? "py-1 text-[11px]" : "py-1.5 text-xs"} border ${value === o.key ? "bg-accent text-app border-accent font-semibold" : "bg-white/[0.04] border-white/[0.07] text-soft"}`}>
          {tr(o.label)}
        </button>
      ))}
    </div>
  );

  const save = async () => {
    const chosen = hadIssue ? Object.values(issues) : [];
    if (hadIssue && chosen.length === 0) return alert(tr("Elija qué ejercicio le molestó, o marque que no le molestó nada."));
    setBusy(true);
    const { data, error } = await saveCheckout(supabase, { userId, weekStart, dayLabel, effort, issues: chosen, comment });
    setBusy(false);
    if (error) return alert(tr("No se pudo guardar el check-out."));
    onSaved?.(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-deep border border-white/[0.06] w-full max-w-md rounded-t-3xl md:rounded-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5 max-h-[92dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <p className="text-accent text-xs font-semibold">{tr("Check-out (opcional)")}</p>
            <h2 className="text-ink text-lg font-semibold leading-tight mt-0.5">{tr("¿Cómo le fue hoy?")}</h2>
          </div>
          <button onClick={onClose} aria-label={tr("Cerrar")} className="text-muted shrink-0"><X size={20} /></button>
        </div>
        <p className="text-soft text-xs mb-4">{tr("Le llega a su coach para ajustar su entrenamiento.")}</p>

        <p className="text-ink text-sm font-medium mb-2">{tr("¿Qué tan duro estuvo? (1 = muy fácil, 10 = máximo)")}</p>
        <div className="grid grid-cols-10 gap-1 mb-5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" onClick={() => setEffort(effort === n ? null : n)}
              className={`rounded-lg py-2 text-sm tabular-nums ${effort === n ? "bg-accent text-app font-semibold" : "bg-white/[0.04] text-soft"}`}>{n}</button>
          ))}
        </div>

        <p className="text-ink text-sm font-medium mb-2">{tr("¿Le molestó algún ejercicio?")}</p>
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setHadIssue(false)} className={`flex-1 rounded-xl py-2.5 text-sm ${hadIssue === false ? "bg-accent text-app font-semibold" : "bg-white/[0.04] text-soft"}`}>{tr("No, todo bien")}</button>
          <button type="button" onClick={() => setHadIssue(true)} className={`flex-1 rounded-xl py-2.5 text-sm ${hadIssue === true ? "bg-danger text-white font-semibold" : "bg-white/[0.04] text-soft"}`}>{tr("Sí, algo me molestó")}</button>
        </div>

        {hadIssue && (
          <div className="mb-4">
            <p className="text-soft text-xs mb-2">{tr("Toque el ejercicio (o los ejercicios) que le molestó.")}</p>
            <div className="space-y-2">
              {list.map((e) => {
                const k = keyOf(e);
                const it = issues[k];
                return (
                  <div key={k} className={`rounded-2xl border ${it ? "border-danger/40 bg-danger/[0.06]" : "border-white/[0.06] bg-white/[0.03]"}`}>
                    <button type="button" onClick={() => toggleEx(e)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${it ? "bg-danger" : "border border-field-strong"}`}>{it && <Check size={13} strokeWidth={3} className="text-white" />}</span>
                      <span className="text-ink text-sm">{e.name}</span>
                    </button>
                    {it && (
                      <div className="px-3 pb-3 space-y-3">
                        <div><p className="text-muted text-[11px] mb-1">{tr("¿Dónde?")}</p>{chips(ISSUE_ZONES, it.zone, (v) => setIssue(k, { zone: v }), true)}</div>
                        <div><p className="text-muted text-[11px] mb-1">{tr("¿De qué lado?")}</p>{chips(ISSUE_SIDES, it.side, (v) => setIssue(k, { side: v }), true)}</div>
                        <div><p className="text-muted text-[11px] mb-1">{tr("¿Cómo se sintió?")}</p>{chips(ISSUE_KINDS, it.kind, (v) => setIssue(k, { kind: v }), true)}</div>
                        <div>
                          <p className="text-muted text-[11px] mb-1">{tr("¿Qué tan fuerte? (1 a 10)")}</p>
                          <div className="grid grid-cols-10 gap-1">
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                              <button key={n} type="button" onClick={() => setIssue(k, { intensity: it.intensity === n ? null : n })}
                                className={`rounded-md py-1.5 text-xs tabular-nums ${it.intensity === n ? (n >= 7 ? "bg-danger text-white font-semibold" : "bg-accent text-app font-semibold") : "bg-white/[0.04] text-soft"}`}>{n}</button>
                            ))}
                          </div>
                        </div>
                        <div><p className="text-muted text-[11px] mb-1">{tr("¿Cuándo?")}</p>{chips(ISSUE_TIMES, it.when, (v) => setIssue(k, { when: v }), true)}</div>
                        <input value={it.note || ""} maxLength={300} onChange={(ev) => setIssue(k, { note: ev.target.value })} placeholder={tr("Detalle (opcional)")}
                          className="w-full bg-app/60 border border-white/[0.07] text-ink text-sm rounded-xl px-3 py-2 outline-none focus:border-accent/50" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-ink text-sm font-medium mb-2">{tr("Comentario para su coach (opcional)")}</p>
        <textarea value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} rows={3} placeholder={tr("Cómo se sintió, qué le costó, qué le gustó...")}
          className="w-full bg-app/60 border border-white/[0.07] text-ink text-[15px] rounded-xl px-3 py-2.5 outline-none focus:border-accent/50 resize-y mb-4" />

        <div className="flex gap-2">
          <button onClick={save} disabled={busy || (effort == null && hadIssue == null && !comment.trim())} className="flex-1 bg-accent text-app font-semibold text-sm rounded-xl py-3 disabled:opacity-50">
            {busy ? tr("Guardando...") : tr("Enviar check-out")}
          </button>
          <button onClick={onClose} className="bg-white/[0.04] text-soft text-sm rounded-xl px-4 py-3">{tr("Ahora no")}</button>
        </div>
      </div>
    </div>
  );
}
