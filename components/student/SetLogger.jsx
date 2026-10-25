"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Timer, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { currentWeekStartISO } from "@/lib/dates";
import { tr } from "@/lib/i18n";
import { cleanDecimal, cleanInt } from "@/lib/numbers";

// Primer número de las reps sugeridas ("8-10" → 8) para "Marcar todas como sugeridas"
const firstNumber = (text) => {
  const m = String(text || "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

const inputCls =
  "w-full min-w-0 bg-app/60 border border-white/[0.07] text-ink text-[15px] text-center rounded-xl px-2 py-2.5 outline-none focus:border-accent/50 disabled:opacity-70";

// Hoja para registrar cada serie de un ejercicio (peso y reps)
export function SetLogger({ exercise, routine, userId, onClose, onComplete, onUncomplete, onStartRest }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const routineId = exercise.routineId || routine.id;
  const byItem = exercise.byItem && exercise.itemKey;
  const restSeconds = Math.round((Number(exercise.restMinutes) || 1.5) * 60);
  const targetWeight = exercise.targetWeight != null ? String(exercise.targetWeight) : "";

  // Trae las series ya registradas esta semana para este ejercicio
  useEffect(() => {
    async function load() {
      let q = supabase
        .from("progress_sets")
        .select("id, set_number, weight_kg, reps")
        .eq("user_id", userId)
        .eq("routine_id", routineId)
        .eq("day_label", routine.day_label)
        .gte("completed_at", currentWeekStartISO());
      q = byItem ? q.eq("item_key", exercise.itemKey) : q.eq("exercise_id", exercise.exerciseId);
      const { data } = await q.order("set_number");
      const saved = data || [];
      const count = Math.max(exercise.setsCount || 1, ...saved.map((s) => s.set_number), 1);
      setRows(
        Array.from({ length: count }, (_, i) => {
          const s = saved.find((x) => x.set_number === i + 1);
          return s
            ? { n: i + 1, weight: s.weight_kg ?? "", reps: s.reps ?? "", done: true, id: s.id }
            : { n: i + 1, weight: targetWeight, reps: firstNumber(exercise.targetReps) ?? "", done: false, id: null };
        })
      );
      setLoading(false);
    }
    load();
  }, []);

  const rowValues = (r) => ({
    user_id: userId,
    routine_id: routineId,
    exercise_id: exercise.exerciseId,
    item_key: exercise.itemKey || null,
    day_label: routine.day_label,
    set_number: r.n,
    weight_kg: r.weight === "" || r.weight == null ? null : Number(r.weight),
    reps: r.reps === "" || r.reps == null ? null : Math.round(Number(r.reps)),
  });

  // Cuando cambian las series: si están todas hechas, el ejercicio queda hecho; si se desmarca una, deja de estarlo
  const syncExercise = async (next) => {
    const allDone = next.length > 0 && next.every((r) => r.done);
    const weights = next.filter((r) => r.done && r.weight !== "" && r.weight != null).map((r) => Number(r.weight));
    if (allDone && !exercise.completed) await onComplete(weights.length ? Math.max(...weights) : null);
    if (!allDone && exercise.completed) await onUncomplete();
  };

  const toggleRow = async (idx) => {
    if (busy) return;
    setBusy(true);
    const r = rows[idx];
    let next = rows;
    if (!r.done) {
      const { data, error } = await supabase.from("progress_sets").insert(rowValues(r)).select("id").single();
      if (error) {
        setBusy(false);
        return alert(tr("No se pudo guardar la serie: ") + error.message);
      }
      navigator.vibrate?.(12);
      next = rows.map((x, i) => (i === idx ? { ...x, done: true, id: data.id } : x));
    } else {
      const { error } = await supabase.from("progress_sets").delete().eq("id", r.id);
      if (error) {
        setBusy(false);
        return alert(tr("No se pudo actualizar la serie: ") + error.message);
      }
      next = rows.map((x, i) => (i === idx ? { ...x, done: false, id: null } : x));
    }
    setRows(next);
    await syncExercise(next);
    setBusy(false);
  };

  const markAllSuggested = async () => {
    if (busy) return;
    const pending = rows.filter((r) => !r.done);
    if (!pending.length) return;
    setBusy(true);
    const { data, error } = await supabase.from("progress_sets").insert(pending.map(rowValues)).select("id, set_number");
    if (error) {
      setBusy(false);
      return alert(tr("No se pudo guardar la serie: ") + error.message);
    }
    navigator.vibrate?.(15);
    const ids = {};
    (data || []).forEach((d) => { ids[d.set_number] = d.id; });
    const next = rows.map((r) => (r.done ? r : { ...r, done: true, id: ids[r.n] ?? null }));
    setRows(next);
    await syncExercise(next);
    setBusy(false);
  };

  const addRow = () => {
    const last = rows[rows.length - 1];
    const next = [...rows, { n: rows.length + 1, weight: last?.weight ?? targetWeight, reps: last?.reps ?? "", done: false, id: null }];
    setRows(next);
    if (exercise.completed) syncExercise(next);
  };

  const update = (idx, field, value) => setRows((list) => list.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const doneCount = rows.filter((r) => r.done).length;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-deep border border-white/[0.06] w-full max-w-md rounded-t-3xl md:rounded-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5 max-h-[88dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-ink text-lg font-semibold leading-tight">{exercise.name}</h2>
          <button onClick={onClose} aria-label={tr("Cerrar")} className="text-muted shrink-0"><X size={20} /></button>
        </div>
        <p className="text-soft text-xs mb-4">
          {[
            exercise.setsCount ? tr("{p0} series", { p0: exercise.setsCount }) : "",
            exercise.targetReps ? tr("{p0} reps", { p0: exercise.targetReps }) : "",
            exercise.targetWeight != null ? `${exercise.targetWeight} kg` : "",
          ].filter(Boolean).join(" · ") || tr("Registre lo que hizo en cada serie.")}
        </p>

        {loading ? (
          <div className="h-32 rounded-2xl bg-card animate-pulse" />
        ) : (
          <>
            <div className="grid grid-cols-[40px_1fr_1fr_44px] gap-2 px-1 mb-2 text-muted text-[10px] uppercase tracking-wider">
              <span>{tr("Serie")}</span>
              <span className="text-center">{tr("Peso (kg)")}</span>
              <span className="text-center">{tr("Reps")}</span>
              <span />
            </div>
            <div className="space-y-2 mb-4">
              {rows.map((r, idx) => (
                <div key={r.n} className={`grid grid-cols-[40px_1fr_1fr_44px] gap-2 items-center rounded-2xl p-1.5 ${r.done ? "bg-accent/[0.07]" : ""}`}>
                  <span className={`text-sm font-semibold text-center ${r.done ? "text-accent" : "text-soft"}`}>{r.n}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={r.weight}
                    placeholder={targetWeight || "—"}
                    disabled={r.done}
                    onChange={(e) => update(idx, "weight", cleanDecimal(e.target.value))}
                    className={inputCls}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={r.reps}
                    placeholder={exercise.targetReps || "—"}
                    disabled={r.done}
                    onChange={(e) => update(idx, "reps", cleanInt(e.target.value))}
                    className={inputCls}
                  />
                  <button
                    onClick={() => toggleRow(idx)}
                    disabled={busy}
                    aria-label={r.done ? tr("Desmarcar serie") : tr("Marcar serie")}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${r.done ? "bg-accent" : "border-2 border-field-strong"}`}
                  >
                    {r.done && <Check size={16} strokeWidth={3} className="text-app animate-check-pop" />}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-3">
              <button onClick={addRow} className="flex-1 flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.06] text-soft text-sm rounded-xl py-2.5">
                <Plus size={14} /> {tr("Agregar serie")}
              </button>
              <button
                onClick={() => onStartRest(restSeconds)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.06] text-ink text-sm rounded-xl py-2.5"
              >
                <Timer size={14} /> {tr("Descanso")} {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")}
              </button>
            </div>

            {doneCount < rows.length ? (
              <button onClick={markAllSuggested} disabled={busy} className="block w-full bg-accent text-app font-semibold text-sm rounded-xl py-3 active:scale-[0.98] transition-transform disabled:opacity-60">
                {tr("Marcar todas como sugeridas")}
              </button>
            ) : (
              <button onClick={onClose} className="block w-full bg-accent text-app font-semibold text-sm rounded-xl py-3">
                {tr("Listo")}
              </button>
            )}
            <p className="text-muted text-[11px] text-center mt-2">{tr("{p0} de {p1} series hechas", { p0: doneCount, p1: rows.length })}</p>
          </>
        )}
      </div>
    </div>
  );
}
