"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Play, X } from "lucide-react";
import { blockTypeLabel } from "@/lib/blocks";
import { currentWeekStartISO } from "@/lib/dates";
import { appLocale, tr } from "@/lib/i18n";
import { downloadRoutinePdf } from "@/lib/planPdf";
import { supabase } from "@/lib/supabaseClient";
import { safeHttpUrl } from "@/lib/url";
import { Confetti } from "@/components/ui/Confetti";
import { RestTimer } from "@/components/student/RestTimer";
import { SetLogger } from "@/components/student/SetLogger";

export function RoutineScreen({ routine, userId, onClose, onToggle, onProgressChange }) {
  const [detailIndex, setDetailIndex] = useState(null);
  const [loggerIndex, setLoggerIndex] = useState(null);
  const [rest, setRest] = useState(null); // { endsAt, total }
  const [celebrate, setCelebrate] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const ids = (routine.parts || [routine]).map((p) => p.id);
      await downloadRoutinePdf({ supabase, routineIds: ids, dayTitle: tr(routine.day_label), t: tr, locale: appLocale() });
    } catch (e) {
      alert(tr("No se pudo generar el PDF: "));
    }
    setPdfBusy(false);
  };
  const total = routine.exercises.length;
  const done = routine.exercises.filter((e) => e.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Tocar el círculo abre la hoja de series del ejercicio
  const toggle = (i) => setLoggerIndex(i);

  // Todas las series hechas → el ejercicio queda hecho (con el mejor peso del día)
  const completeExercise = async (i, bestWeight) => {
    const ex = routine.exercises[i];
    onToggle(i, true);
    navigator.vibrate?.(15); // vibración suave en celulares que lo permiten
    const othersDone = routine.exercises.filter((e, j) => j !== i && e.completed).length;
    if (othersDone + 1 === routine.exercises.length) {
      setCelebrate(true);
      setLoggerIndex(null);
      navigator.vibrate?.([20, 60, 30]);
    }
    const { error } = await supabase.from("progress").insert({
      user_id: userId,
      routine_id: ex.routineId || routine.id,
      exercise_id: ex.exerciseId,
      item_key: ex.itemKey || null,
      day_label: routine.day_label,
      weight_kg: bestWeight,
    });
    if (error) {
      alert(tr("No se pudo guardar su progreso: "));
      onToggle(i, false);
    } else {
      onProgressChange();
    }
  };

  // Se desmarcó alguna serie → el ejercicio deja de estar hecho
  const uncompleteExercise = async (i) => {
    const ex = routine.exercises[i];
    onToggle(i, false);
    let deleteQuery = supabase
      .from("progress")
      .delete()
      .eq("user_id", userId)
      .eq("routine_id", ex.routineId || routine.id)
      .eq("day_label", routine.day_label)
      .gte("completed_at", currentWeekStartISO());
    deleteQuery = ex.byItem && ex.itemKey ? deleteQuery.eq("item_key", ex.itemKey) : deleteQuery.eq("exercise_id", ex.exerciseId);
    const { error } = await deleteQuery;
    if (error) {
      alert(tr("No se pudo actualizar su progreso: "));
      onToggle(i, true);
    } else {
      onProgressChange();
    }
  };

  const startRest = (seconds) => setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
  const detail = detailIndex !== null ? routine.exercises[detailIndex] : null;

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      {celebrate && <Confetti onDone={() => setTimeout(() => setCelebrate(false), 1200)} />}
      {celebrate && (
        <div className="fixed inset-x-0 top-1/3 z-[61] flex justify-center px-6 pointer-events-none">
          <div className="animate-celebrate bg-panel border border-accent/30 rounded-3xl px-6 py-5 text-center shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)]">
            <p className="text-3xl mb-1">🎉</p>
            <p className="text-ink text-lg font-semibold">{tr("¡Entrenamiento completado!")}</p>
            <p className="text-soft text-sm">{tr("Excelente trabajo hoy.")}</p>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden md:rounded-3xl bg-gradient-to-br from-card to-deep border-b md:border border-white/[0.06] px-5 pt-4 pb-5">
        <div className="relative flex items-center justify-between mb-5">
          <button onClick={onClose} aria-label={tr("Volver")} className="w-9 h-9 rounded-full bg-app/50 border border-white/[0.06] flex items-center justify-center active:scale-90 transition-transform">
            <ChevronLeft size={18} className="text-ink" />
          </button>
          <button onClick={downloadPdf} disabled={pdfBusy} className="flex items-center gap-1.5 h-9 rounded-full bg-app/50 border border-white/[0.06] px-3 text-soft text-xs disabled:opacity-60">
            <Download size={14} /> {pdfBusy ? tr("Generando...") : "PDF"}
          </button>
        </div>
        <p className="relative text-accent text-xs font-medium mb-1">{tr(routine.day_label)}</p>
        <h1 className="relative text-ink text-2xl font-semibold tracking-tight mb-4">{routine.parts?.length > 1 ? tr("Su entrenamiento") : routine.title}</h1>
        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-ink text-sm font-semibold tabular-nums">{done}/{total}</span>
        </div>
      </div>

      <div className="px-5 pt-5">

        <div className="space-y-8">
          {(routine.parts || [routine]).map((part, partIdx, allParts) => {
            const partItems = routine.exercises.filter((ex) => (ex.partIndex ?? 0) === (part.partIndex ?? 0));
            const partDone = partItems.filter((ex) => ex.completed).length;
            return (
              <div key={`${part.id}-${partIdx}`}>
                {allParts.length > 1 && (
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b border-field">
                    <span className="w-7 h-7 rounded-full bg-accent text-app text-xs font-semibold flex items-center justify-center shrink-0">{partIdx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-ink text-lg font-semibold truncate">{part.title}</h2>
                      <p className="text-muted text-xs">{[part.duration_minutes ? `${part.duration_minutes} ${tr("min")}` : "", `${partDone}/${partItems.length} ${tr("hechos")}`].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                )}
                {part.blocks?.length > 0 ? (
                  <div className="space-y-5">
                    {part.blocks.map((b) => {
                      const items = routine.exercises.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.partIndex === part.partIndex && ex.blockId === b.id);
                      const doneCount = items.filter(({ ex }) => ex.completed).length;
                      return (
                        <section key={b.id}>
                          <div className="flex items-end justify-between gap-3 mb-2">
                            <div className="min-w-0">
                              {b.title && b.title !== blockTypeLabel(b.block_type) && (
                                <p className="text-accent text-[10px] uppercase tracking-wider">{tr(blockTypeLabel(b.block_type))}</p>
                              )}
                              <h2 className="text-ink text-base font-semibold truncate">{b.title && b.title !== blockTypeLabel(b.block_type) ? b.title : tr(blockTypeLabel(b.block_type))}</h2>
                            </div>
                            <div className="text-right shrink-0">
                              {b.sets && <p className="text-ink text-sm font-medium">{b.sets} {tr("series")}</p>}
                              {items.length > 0 && <p className="text-muted text-[11px]">{doneCount}/{items.length} {tr("hechos")}</p>}
                            </div>
                          </div>
                          {b.notes && <p className="text-soft text-xs bg-card rounded-lg px-3 py-2 mb-2">{b.notes}</p>}
                          <div className="space-y-2">
                            {items.map(({ ex, i }) => (
                              <div key={i} className={`flex items-center justify-between rounded-2xl px-4 py-3 transition-colors ${ex.completed ? "bg-card/60" : "bg-card"}`}>
                                <div className="flex items-center gap-3">
                                  <button onClick={() => toggle(i)} className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${ex.completed ? "bg-accent" : "border-2 border-field-strong"}`}>
                                    {ex.completed && <Check size={14} strokeWidth={3} className="text-app animate-check-pop" />}
                                  </button>
                                  <div>
                                    <p className={`text-sm ${ex.completed ? "text-muted line-through" : "text-ink"}`}>{ex.name}</p>
                                    {(ex.rowLabel || ex.targetWeight != null) && (
                                      <p className="text-muted text-xs">{[ex.rowLabel, ex.targetWeight != null ? `${ex.targetWeight} kg` : ""].filter(Boolean).join(" · ")}</p>
                                    )}
                                  </div>
                                </div>
                                <button onClick={() => setDetailIndex(i)} className="text-muted">
                                  <ChevronRight size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {routine.exercises.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.partIndex === part.partIndex).map(({ ex, i }) => (
                      <div key={i} className={`flex items-center justify-between rounded-2xl px-4 py-3 transition-colors ${ex.completed ? "bg-card/60" : "bg-card"}`}>
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggle(i)} className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${ex.completed ? "bg-accent" : "border-2 border-field-strong"}`}>
                            {ex.completed && <Check size={14} strokeWidth={3} className="text-app animate-check-pop" />}
                          </button>
                          <div>
                            <p className={`text-sm ${ex.completed ? "text-muted line-through" : "text-ink"}`}>{ex.name}</p>
                            {ex.sets && <p className="text-muted text-xs">{ex.sets}</p>}
                          </div>
                        </div>
                        <button onClick={() => setDetailIndex(i)} className="text-muted">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={onClose} className="block w-full bg-accent text-app font-semibold py-3.5 rounded-2xl mt-6 active:scale-[0.98] transition-transform">
          {tr("Continuar rutina")}
        </button>
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50" onClick={() => setDetailIndex(null)}>
          <div className="bg-deep w-full max-w-md rounded-t-2xl md:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-ink text-lg font-semibold">{detail.name}</h2>
              <button onClick={() => setDetailIndex(null)} className="text-muted"><X size={20} /></button>
            </div>
            {detail.sets && <p className="text-soft text-sm mb-4">{detail.sets}</p>}
            {detail.targetWeight != null && (
              <p className="text-accent text-sm mb-4">{tr("Peso sugerido:")} {detail.targetWeight} {tr("kg")}</p>
            )}
            {detail.restMinutes != null && (
              <p className="text-soft text-sm mb-4">{tr("Descanso:")} {detail.restMinutes} {tr("min")}</p>
            )}
            {safeHttpUrl(detail.videoUrl) ? (
              <a href={safeHttpUrl(detail.videoUrl)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-accent text-app font-semibold py-3 rounded-xl">
                <Play size={16} fill="#0F1512" /> {tr("Ver video")}
              </a>
            ) : (
              <p className="text-muted text-sm italic">{tr("Este ejercicio todavía no tiene video.")}</p>
            )}
          </div>
        </div>
      )}

      {loggerIndex !== null && (
        <SetLogger
          key={loggerIndex}
          exercise={routine.exercises[loggerIndex]}
          routine={routine}
          userId={userId}
          onClose={() => setLoggerIndex(null)}
          onComplete={(w) => completeExercise(loggerIndex, w)}
          onUncomplete={() => uncompleteExercise(loggerIndex)}
          onStartRest={startRest}
        />
      )}
      {rest && (
        <RestTimer
          endsAt={rest.endsAt}
          total={rest.total}
          onChange={(d) => setRest((r) => ({ endsAt: Math.max(Date.now(), r.endsAt + d * 1000), total: Math.max(15, r.total + d) }))}
          onClose={() => setRest(null)}
        />
      )}
    </div>
  );
}
