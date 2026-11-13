"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, MessageSquarePlus, MessageSquareText, Pencil, Play, SquarePen, X } from "lucide-react";
import { blockTypeLabel } from "@/lib/blocks";
import { currentWeekStartISO } from "@/lib/dates";
import { appLocale, tr } from "@/lib/i18n";
import { buildRoutinePdf } from "@/lib/planPdf";
import { usePdfPreview } from "@/components/ui/PdfPreview";
import { supabase } from "@/lib/supabaseClient";
import { safeHttpUrl } from "@/lib/url";
import { formatWeight, useWeightUnit } from "@/lib/weightUnits";
import { youtubeVideo } from "@/lib/youtube";
import { Confetti } from "@/components/ui/Confetti";
import { RestTimer } from "@/components/student/RestTimer";
import { SetLogger } from "@/components/student/SetLogger";

// Primer número de las reps sugeridas ("8-10" → 8)
const firstNumber = (text) => {
  const m = String(text || "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

// preview = el coach ve la rutina tal como la ve el alumno (sin marcar nada) y puede dejar observaciones (onEditNote)
export function RoutineScreen({ routine, userId, onClose, onToggle, onProgressChange, preview = false, onEditNote = null }) {
  const [unit] = useWeightUnit();
  const [detailIndex, setDetailIndex] = useState(null);
  const [playing, setPlaying] = useState(false); // el video solo se carga cuando el alumno toca "Ver video"
  const openDetail = (i) => { setPlaying(false); setDetailIndex(i); };
  const closeDetail = () => { setPlaying(false); setDetailIndex(null); };
  const [loggerIndex, setLoggerIndex] = useState(null);
  const [rest, setRest] = useState(null); // { endsAt, total }
  const [celebrate, setCelebrate] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [showPdf, pdfPreview] = usePdfPreview(tr);
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const ids = (routine.parts || [routine]).map((p) => p.id);
      showPdf(await buildRoutinePdf({ supabase, routineIds: ids, dayTitle: tr(routine.day_label), t: tr, locale: appLocale(), changes: routine.planChanges || [], week: routine.planWeek || 0 }));
    } catch {
      alert(tr("No se pudo generar el PDF: "));
    }
    setPdfBusy(false);
  };
  // ---------- Rutinas por bloques: se marca de a UNA serie por ejercicio ----------
  // setsDone = { "rutina|item_key": [{ id, n, w }] } con las series ya hechas esta semana
  const [setsDone, setSetsDone] = useState({});
  const [savingSet, setSavingSet] = useState(false);
  const setKey = (ex) => `${ex.routineId || routine.id}|${ex.itemKey}`;
  const bySet = (ex) => !!(ex.byItem && ex.itemKey && ex.setsCount > 0);
  async function loadSets() {
    const ids = [...new Set(routine.exercises.filter((e) => e.byItem).map((e) => e.routineId || routine.id))];
    if (!ids.length || !userId) return;
    const { data } = await supabase
      .from("progress_sets")
      .select("id, routine_id, item_key, set_number, weight_kg")
      .eq("user_id", userId)
      .in("routine_id", ids)
      .eq("day_label", routine.day_label)
      .gte("completed_at", currentWeekStartISO());
    const map = {};
    (data || []).forEach((r) => {
      if (!r.item_key) return;
      const k = `${r.routine_id}|${r.item_key}`;
      (map[k] = map[k] || []).push({ id: r.id, n: r.set_number, w: r.weight_kg });
    });
    setSetsDone(map);
  }
  useEffect(() => { loadSets(); }, [routine.day_label, routine.id, userId]);
  const doneOf = (ex) => setsDone[setKey(ex)] || [];

  // Marca la siguiente serie del ejercicio (con el peso y las reps sugeridas)
  const markNextSet = async (i) => {
    const ex = routine.exercises[i];
    const done = doneOf(ex);
    const nums = new Set(done.map((d) => d.n));
    let n = 1;
    while (nums.has(n)) n++;
    if (n > ex.setsCount || savingSet) return;
    setSavingSet(true);
    const { data, error } = await supabase
      .from("progress_sets")
      .insert({
        user_id: userId,
        routine_id: ex.routineId || routine.id,
        exercise_id: ex.exerciseId,
        item_key: ex.itemKey,
        day_label: routine.day_label,
        set_number: n,
        weight_kg: ex.targetWeight ?? null,
        reps: firstNumber(ex.targetReps),
      })
      .select("id")
      .single();
    if (error) {
      setSavingSet(false);
      return alert(tr("No se pudo guardar la serie: "));
    }
    navigator.vibrate?.(12);
    const next = [...done, { id: data.id, n, w: ex.targetWeight ?? null }];
    setSetsDone((m) => ({ ...m, [setKey(ex)]: next }));
    if (next.length >= ex.setsCount && !ex.completed) {
      const ws = next.map((d) => d.w).filter((w) => w != null).map(Number);
      await completeExercise(i, ws.length ? Math.max(...ws) : null);
    }
    setSavingSet(false);
  };

  // Desmarca la última serie hecha del ejercicio
  const unmarkLastSet = async (i) => {
    const ex = routine.exercises[i];
    const done = doneOf(ex);
    if (!done.length || savingSet) return;
    const last = done.reduce((a, b) => (b.n > a.n ? b : a));
    setSavingSet(true);
    const { error } = await supabase.from("progress_sets").delete().eq("id", last.id);
    if (error) {
      setSavingSet(false);
      return alert(tr("No se pudo actualizar la serie: "));
    }
    setSetsDone((m) => ({ ...m, [setKey(ex)]: done.filter((d) => d.id !== last.id) }));
    if (ex.completed) await uncompleteExercise(i);
    setSavingSet(false);
  };

  // Serie del bloque en la que va (la más atrasada de sus ejercicios)
  const blockRound = (items) => {
    const list = items.filter(({ ex }) => bySet(ex));
    if (!list.length) return null;
    const total = Math.max(...list.map(({ ex }) => ex.setsCount));
    const minDone = Math.min(...list.map(({ ex }) => Math.min(doneOf(ex).length, ex.setsCount)));
    return { current: Math.min(minDone + 1, total), total, finished: list.every(({ ex }) => doneOf(ex).length >= ex.setsCount) };
  };

  const total = routine.exercises.length;
  const done = routine.exercises.filter((e) => e.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Tocar el círculo abre la hoja de series del ejercicio
  const toggle = (i) => {
    if (preview) return openDetail(i);
    const ex = routine.exercises[i];
    if (bySet(ex) && doneOf(ex).length < ex.setsCount) return markNextSet(i);
    setLoggerIndex(i);
  };

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
  const videoLink = detail ? safeHttpUrl(detail.videoUrl) : null;
  const video = detail ? youtubeVideo(detail.videoUrl) : null;

  // Puntos de series (rutinas por bloques): tocar el siguiente marca esa serie; tocar el último hecho lo desmarca
  const setDots = (ex, i) => {
    const done = doneOf(ex);
    const nums = new Set(done.map((d) => d.n));
    const lastDone = done.length ? Math.max(...done.map((d) => d.n)) : 0;
    let nextN = 1;
    while (nums.has(nextN)) nextN++;
    return (
      <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
        {Array.from({ length: ex.setsCount }, (_, k) => {
          const n = k + 1;
          const isDone = nums.has(n);
          const clickable = !preview && !savingSet && ((isDone && n === lastDone) || (!isDone && n === nextN));
          return (
            <button
              key={n}
              type="button"
              disabled={!clickable}
              onClick={() => (isDone ? unmarkLastSet(i) : markNextSet(i))}
              aria-label={isDone ? tr("Desmarcar serie {p0}", { p0: n }) : tr("Marcar serie {p0}", { p0: n })}
              className={`w-6 h-6 rounded-full text-[10px] font-semibold flex items-center justify-center transition-all active:scale-90 ${
                isDone ? "bg-accent text-app" : n === nextN && !preview ? "border-2 border-accent/70 text-accent" : "border border-field-strong text-muted"
              } disabled:cursor-default`}
            >
              {isDone ? <Check size={11} strokeWidth={3} /> : n}
            </button>
          );
        })}
        <span className="text-muted text-[11px] ml-1">
          {done.length >= ex.setsCount ? tr("Series completas") : tr("Serie {p0} de {p1}", { p0: Math.min(done.length + 1, ex.setsCount), p1: ex.setsCount })}
        </span>
      </div>
    );
  };

  // Fila de un ejercicio. Si el coach le dejó una observación, se ve la marca antes de abrirlo.
  const exerciseRow = (ex, i, subtitle) => (
    <div key={i} onClick={() => openDetail(i)} className={`flex items-center justify-between gap-2 rounded-2xl px-4 py-3 group cursor-pointer transition duration-200 ease-out hover:scale-[1.02] hover:bg-card-hover active:scale-[0.99] ${ex.completed ? "bg-card/60" : "bg-card"}`}>
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={(e) => { e.stopPropagation(); toggle(i); }}
          aria-label={preview ? tr("Ver ejercicio") : undefined}
          disabled={savingSet && bySet(ex)}
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${ex.completed ? "bg-accent" : bySet(ex) && doneOf(ex).length > 0 ? "border-2 border-accent" : "border-2 border-field-strong"} ${preview ? "cursor-default" : ""}`}
        >
          {ex.completed ? (
            <Check size={14} strokeWidth={3} className="text-app animate-check-pop" />
          ) : bySet(ex) && doneOf(ex).length > 0 ? (
            <span className="text-accent text-[10px] font-semibold tabular-nums">{doneOf(ex).length}/{ex.setsCount}</span>
          ) : null}
        </button>
        <div className="min-w-0">
          <p className={`text-sm ${ex.completed ? "text-muted line-through" : "text-ink"}`}>{ex.name}</p>
          {subtitle && <p className="text-muted text-xs">{subtitle}</p>}
          {bySet(ex) && setDots(ex, i)}
          {ex.note && (
            <p className="inline-flex items-center gap-1 text-accent text-[11px] font-medium mt-0.5">
              <MessageSquareText size={12} /> {tr("Tiene observación de su coach")}
            </p>
          )}
        </div>
      </div>
      {preview && onEditNote && ex.itemKey ? (
        <button
          onClick={(e) => { e.stopPropagation(); onEditNote(ex); }}
          className={`shrink-0 flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 ${ex.note ? "bg-accent/15 text-accent" : "bg-field text-soft hover:text-ink"}`}
        >
          {ex.note ? <Pencil size={12} /> : <MessageSquarePlus size={12} />} {ex.note ? "Editar" : "Observación"}
        </button>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); openDetail(i); }} aria-label={tr("Ver ejercicio")} className="text-muted transition-colors group-hover:text-ink shrink-0">
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );

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
                      const round = blockRound(items);
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
                              {round ? (
                                <p className={`text-sm font-medium ${round.finished ? "text-accent" : "text-ink"}`}>
                                  {round.finished ? tr("Bloque completo") : tr("Serie {p0} de {p1}", { p0: round.current, p1: round.total })}
                                </p>
                              ) : (
                                b.sets && <p className="text-ink text-sm font-medium">{b.sets} {tr("series")}</p>
                              )}
                              {items.length > 0 && <p className="text-muted text-[11px]">{doneCount}/{items.length} {tr("hechos")}</p>}
                            </div>
                          </div>
                          {b.notes && <p className="text-soft text-xs bg-card rounded-lg px-3 py-2 mb-2">{b.notes}</p>}
                          <div className="space-y-2">
                            {items.map(({ ex, i }) => exerciseRow(ex, i, [ex.rowLabel, formatWeight(ex.targetWeight, unit)].filter(Boolean).join(" · ")))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {routine.exercises.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.partIndex === part.partIndex).map(({ ex, i }) => exerciseRow(ex, i, ex.sets))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!preview && (
          <button onClick={onClose} className="block w-full bg-accent text-app font-semibold py-3.5 rounded-2xl mt-6 active:scale-[0.98] transition-transform">
            {tr("Continuar rutina")}
          </button>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50" onClick={closeDetail}>
          <div className="bg-deep w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-2xl md:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-ink text-lg font-semibold">{detail.name}</h2>
              <button onClick={closeDetail} aria-label={tr("Cerrar")} className="text-muted"><X size={20} /></button>
            </div>
            {detail.note && (
              <div className="bg-accent/10 border border-accent/30 rounded-xl px-3.5 py-3 mb-4">
                <p className="text-accent text-xs font-semibold flex items-center gap-1.5 mb-1">
                  <MessageSquareText size={14} /> {tr("Observación de su coach")}
                </p>
                <p className="text-ink text-sm whitespace-pre-wrap break-words">{detail.note}</p>
              </div>
            )}
            {preview && onEditNote && (
              detail.itemKey ? (
                <button onClick={() => onEditNote(detail)} className="w-full mb-4 flex items-center justify-center gap-1.5 bg-field text-ink text-sm rounded-xl py-2.5 hover:bg-field-hover">
                  {detail.note ? <Pencil size={14} /> : <MessageSquarePlus size={14} />} {detail.note ? "Editar observación" : "Agregar observación"}
                </button>
              ) : (
                <p className="text-muted text-xs mb-4">Este ejercicio no tiene clave fija: guardá la rutina una vez (Rutinas → editar → guardar) para poder dejarle observaciones.</p>
              )
            )}
            {detail.sets && <p className="text-soft text-sm mb-4">{detail.sets}</p>}
            {!preview && bySet(detail) && (
              <button onClick={() => { const i = detailIndex; closeDetail(); setLoggerIndex(i); }} className="w-full mb-4 flex items-center justify-center gap-1.5 bg-field text-ink text-sm rounded-xl py-2.5 hover:bg-field-hover">
                <SquarePen size={14} /> {tr("Anotar peso y reps de cada serie")}
              </button>
            )}
            {detail.targetWeight != null && (
              <p className="text-accent text-sm mb-4">{tr("Peso sugerido:")} {formatWeight(detail.targetWeight, unit)}</p>
            )}
            {detail.restMinutes != null && (
              <p className="text-soft text-sm mb-4">{tr("Descanso:")} {detail.restMinutes} {tr("min")}</p>
            )}
            {video && playing ? (
              // Video de YouTube dentro de la ficha (Shorts en vertical). Se usa el reproductor "sin cookies".
              <div className="animate-fade-in">
                <div className={`relative mx-auto overflow-hidden rounded-xl bg-black ${video.vertical ? "aspect-[9/16] h-[58dvh] max-w-full" : "aspect-video w-full"}`}>
                  <iframe
                    src={video.embedUrl}
                    title={detail.name}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="absolute inset-0 w-full h-full border-0"
                  />
                </div>
                <a href={videoLink} target="_blank" rel="noopener noreferrer" className="block text-center text-muted text-xs mt-3 hover:text-ink transition-colors">
                  {tr("Abrir en YouTube")}
                </a>
              </div>
            ) : video ? (
              <button type="button" onClick={() => setPlaying(true)} className="w-full flex items-center justify-center gap-2 bg-accent text-app font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform">
                <Play size={16} fill="#0F1512" /> {tr("Ver video")}
              </button>
            ) : videoLink ? (
              // Enlaces que no son de YouTube: se abren en otra pestaña, como antes
              <a href={videoLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-accent text-app font-semibold py-3 rounded-xl">
                <Play size={16} fill="#0F1512" /> {tr("Ver video")}
              </a>
            ) : (
              <p className="text-muted text-sm italic">{tr("Este ejercicio todavía no tiene video.")}</p>
            )}
          </div>
        </div>
      )}

      {!preview && loggerIndex !== null && (
        <SetLogger
          key={loggerIndex}
          exercise={routine.exercises[loggerIndex]}
          routine={routine}
          userId={userId}
          onClose={() => { setLoggerIndex(null); loadSets(); }}
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
      {pdfPreview}
    </div>
  );
}
