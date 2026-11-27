"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Lock, MessageCircle, MessageSquarePlus, MessageSquareText, Pencil, Copy, Play, Plus, SlidersHorizontal, SquarePen, Timer, Trash2, X } from "lucide-react";
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
import { openClock, startRest as startRestClock, stopRest } from "@/lib/clockStore";
import { timerLabel } from "@/lib/clock";
import { useClockExercise } from "@/lib/useClockExercise";
import { SetLogger } from "@/components/student/SetLogger";
import { Chameleon } from "@/components/ui/Chameleon";
import { finishSession, fmtFinished, isLocked, loadSession, weekStartISO } from "@/lib/workoutSession";
import { loadCheckout } from "@/lib/checkout";
import { CheckoutSheet } from "./CheckoutSheet";
import { ExerciseCommentBox } from "./ExerciseCommentBox";
import { useBackClose } from "@/lib/backStack";
import { DragHandle, SortableList, SortableRow } from "@/components/ui/Sortable";
import { MenuButton } from "@/components/ui/MenuButton";

import { InfoNote } from "@/components/ui/InfoTip";
// Primer número de las reps sugeridas ("8-10" → 8)
const firstNumber = (text) => {
  const m = String(text || "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

// Id temporal de una serie que todavía se está guardando
let tmpSeq = 0;
const nextTmpId = () => `tmp-${++tmpSeq}`;

// preview = el coach ve la rutina tal como la ve el alumno (sin marcar nada) y puede dejar observaciones (onEditNote)
// coachEdit = (solo con preview) el coach puede corregir peso y reps de las series que el alumno ya hizo (semana actual).
//             El coach nunca marca ni desmarca series ni ejercicios.
// liveTick = (solo con preview) cambia cada vez que el alumno marca algo: se recargan las series al instante
// onEditExercise = (solo con preview) el coach edita peso, series, reps o cambia el ejercicio: se abre tocando
//   el ejercicio o una serie que el alumno todavía no hizo (las ya hechas se corrigen con coachEdit)
// onDeletePart / onDeleteBlock / onMoveBlock / onRemoveTimer = (solo con preview) el coach quita una rutina del
//   día, un bloque o un reloj, y arrastra los bloques para cambiarles el orden (solo para este alumno)
export function RoutineScreen({ routine, userId, pet = null, onClose, onToggle, onProgressChange, preview = false, onEditNote = null, onEditRoutineNote = null, onEditTimer = null, onEditExercise = null, coachEdit = false, liveTick = 0, onDeletePart = null, onDeleteBlock = null, onMoveBlock = null, onRemoveTimer = null, onDeleteRoutineNote = null, onDeleteNote = null, onAddExercise = null, onAddBlock = null, onDuplicateBlock = null, onEditBlockSets = null }) {
  const [unit] = useWeightUnit();
  const [detailIndex, setDetailIndex] = useState(null);
  const [playing, setPlaying] = useState(false); // el video solo se carga cuando el alumno toca "Ver video"
  const openDetail = (i) => { setPlaying(false); setDetailIndex(i); };
  const closeDetail = () => { setPlaying(false); setDetailIndex(null); };
  useBackClose(detailIndex != null, closeDetail); // "atrás" del celular cierra el ejercicio abierto
  const [loggerIndex, setLoggerIndex] = useState(null);
  // El reloj y el descanso entre series viven en lib/clockStore (siguen corriendo en la píldora de arriba)
  const tabataByDefault = (routine.parts || [routine]).some((p) => p.blocks?.some((b) => b.block_type === "intermitentes"));
  const [celebrate, setCelebrate] = useState(false);
  const [justFinished, setJustFinished] = useState(false); // acaba de tocar «Finalizar»: el camaleón celebra
  const [pdfBusy, setPdfBusy] = useState(false);
  const [showPdf, pdfPreview] = usePdfPreview(tr);
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const parts = routine.parts || [routine];
      const ids = parts.map((p) => p.id);
      const extraIds = parts.filter((p) => p.isExtra).map((p) => p.id);
      showPdf(await buildRoutinePdf({ supabase, routineIds: ids, dayTitle: tr(routine.day_label), t: tr, locale: appLocale(), changes: routine.planChanges || [], week: routine.planWeek || 0, extraIds, userId }));
    } catch {
      alert(tr("No se pudo generar el PDF: "));
    }
    setPdfBusy(false);
  };
  // ---------- Rutinas por bloques: se marca de a UNA serie por ejercicio ----------
  // setsDone = { "rutina|item_key": [{ id, n, w }] } con las series ya hechas esta semana
  const [setsDone, setSetsDone] = useState({});
  // Marcar es instantáneo: la serie se ve marcada apenas se toca y se guarda por detrás, en orden.
  // Si algo no se pudo guardar, se desmarca sola y se avisa.
  const savingSet = false;
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const realIds = useRef(new Map()); // id temporal → id real de la serie ya guardada
  const enqueue = (job) => {
    pending.current += 1;
    queue.current = queue.current.then(job).catch(() => {}).finally(() => {
      pending.current -= 1;
      if (pending.current === 0) loadSets(); // al terminar de guardar, queda igual que en el servidor
    });
    return queue.current;
  };
  const setKey = (ex) => `${ex.routineId || routine.id}|${ex.itemKey}`;
  const bySet = (ex) => !!(ex.byItem && ex.itemKey && ex.setsCount > 0);
  async function loadSets() {
    const ids = [...new Set(routine.exercises.filter((e) => e.byItem).map((e) => e.routineId || routine.id))];
    if (!ids.length || !userId) return;
    if (pending.current > 0) return; // hay series guardándose: no se pisa lo que el alumno ya ve marcado
    const { data, error } = await supabase
      .from("progress_sets")
      .select("id, routine_id, item_key, set_number, weight_kg")
      .eq("user_id", userId)
      .eq("day_label", routine.day_label)
      .gte("completed_at", currentWeekStartISO());
    if (error || pending.current > 0) return;
    // Cada serie va con el ejercicio por su clave, aunque se haya marcado en la rutina anterior
    // (el coach la cambió en vivo; la copia conserva las claves)
    const routineOfKey = {};
    routine.exercises.forEach((e) => { if (e.byItem && e.itemKey) routineOfKey[e.itemKey] = e.routineId || routine.id; });
    const map = {};
    (data || []).forEach((r) => {
      if (!r.item_key || !routineOfKey[r.item_key]) return;
      const k = `${routineOfKey[r.item_key]}|${r.item_key}`;
      (map[k] = map[k] || []).push({ id: r.id, n: r.set_number, w: r.weight_kg });
    });
    setSetsDone(map);
  }
  // También se recarga cuando la rutina cambia (por ejemplo, cuando el reloj marca un ejercicio)
  useEffect(() => { loadSets(); }, [routine.day_label, routine.id, routine.exercises, userId, liveTick]);
  // Ejercicio que el Tabata está haciendo ahora: se resalta en la lista
  const enCurso = useClockExercise(preview ? null : routine.day_label);
  const isEnCurso = (ex) => !!enCurso && enCurso === `${ex.routineId || routine.id}|${ex.itemKey ?? ex.exerciseId}`;
  const doneOf = (ex) => setsDone[setKey(ex)] || [];

  // Marca la siguiente serie del ejercicio (con el peso y las reps sugeridas)
  const markNextSet = (i) => {
    const ex = routine.exercises[i];
    const done = doneOf(ex);
    const nums = new Set(done.map((d) => d.n));
    let n = 1;
    while (nums.has(n)) n++;
    if (n > ex.setsCount) return;
    const key = setKey(ex);
    const entry = { id: nextTmpId(), n, w: ex.targetWeight ?? null };
    // 1) Se ve al instante
    setSetsDone((m) => ({ ...m, [key]: [...(m[key] || []), entry] }));
    navigator.vibrate?.(12);
    const next = [...done, entry];
    if (next.length >= ex.setsCount && !ex.completed) {
      const ws = next.map((d) => d.w).filter((w) => w != null).map(Number);
      completeExercise(i, ws.length ? Math.max(...ws) : null);
    }
    // 2) Se guarda por detrás
    enqueue(async () => {
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
      if (error || !data) {
        setSetsDone((m) => ({ ...m, [key]: (m[key] || []).filter((d) => d.id !== entry.id) }));
        alert(tr("No se pudo guardar la serie: "));
        return;
      }
      realIds.current.set(entry.id, data.id);
    });
  };

  // Desmarca la última serie hecha del ejercicio
  const unmarkLastSet = (i) => {
    const ex = routine.exercises[i];
    const done = doneOf(ex);
    if (!done.length) return;
    const key = setKey(ex);
    const last = done.reduce((a, b) => (b.n > a.n ? b : a));
    setSetsDone((m) => ({ ...m, [key]: (m[key] || []).filter((d) => d.id !== last.id) }));
    if (ex.completed) uncompleteExercise(i);
    enqueue(async () => {
      const id = String(last.id).startsWith("tmp-") ? realIds.current.get(last.id) : last.id;
      if (!id) return; // nunca se llegó a guardar: no hay nada que borrar
      const { error } = await supabase.from("progress_sets").delete().eq("id", id);
      if (error) {
        setSetsDone((m) => ({ ...m, [key]: [...(m[key] || []), { ...last, id }] }));
        alert(tr("No se pudo actualizar la serie: "));
      }
    });
  };

  // Serie del bloque en la que va (la más atrasada de sus ejercicios)
  const blockRound = (items) => {
    const list = items.filter(({ ex }) => bySet(ex));
    if (!list.length) return null;
    const total = Math.max(...list.map(({ ex }) => ex.setsCount));
    const minDone = Math.min(...list.map(({ ex }) => Math.min(doneOf(ex).length, ex.setsCount)));
    return { current: Math.min(minDone + 1, total), total, finished: list.every(({ ex }) => doneOf(ex).length >= ex.setsCount) };
  };

  // ---------- Entrenamiento finalizado: el alumno ya no puede cambiar nada (salvo que el coach lo habilite) ----------
  const [session, setSession] = useState(null);
  const [finishing, setFinishing] = useState(false);
  async function loadDaySession() {
    if (preview) return;
    const [s, co] = await Promise.all([
      loadSession(supabase, userId, weekStartISO(), routine.day_label),
      loadCheckout(supabase, userId, weekStartISO(), routine.day_label),
    ]);
    setSession(s);
    setCheckout(co.data);
    setCheckoutOn(!co.missing);
  }
  useEffect(() => { loadDaySession(); }, [routine.day_label, userId]);
  // ---------- Check-out opcional al terminar y comentarios del alumno en cada ejercicio ----------
  const [checkout, setCheckout] = useState(null);
  const [checkoutOn, setCheckoutOn] = useState(false); // false si la tabla todavía no existe
  const [showCheckout, setShowCheckout] = useState(false);
  const [myComments, setMyComments] = useState({});
  const cKey = (ex) => `${ex.routineId || routine.id}|${ex.itemKey || ""}|${ex.exerciseId}`;
  const commentOf = (ex) => (myComments[cKey(ex)] !== undefined ? myComments[cKey(ex)] : ex.studentComment || "");
  const setCommentOf = (ex, text) => setMyComments((m) => ({ ...m, [cKey(ex)]: text }));
  const locked = !preview && isLocked(session);

  const total = routine.exercises.length;
  const done = routine.exercises.filter((e) => e.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Tocar el círculo abre la hoja de series del ejercicio
  const toggle = (i) => {
    if (preview || locked) return openDetail(i);
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
    if (!preview && othersDone + 1 === routine.exercises.length) {
      setCelebrate(true);
      setLoggerIndex(null);
      navigator.vibrate?.([20, 60, 30]);
    }
    await enqueue(async () => {
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
    });
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
    await enqueue(async () => {
      const { error } = await deleteQuery;
      if (error) {
        alert(tr("No se pudo actualizar su progreso: "));
        onToggle(i, true);
      } else {
        onProgressChange();
      }
    });
  };

  const startRest = (seconds) => startRestClock(seconds);
  const detail = detailIndex !== null ? routine.exercises[detailIndex] : null;
  const videoLink = detail ? safeHttpUrl(detail.videoUrl) : null;
  const video = detail ? youtubeVideo(detail.videoUrl) : null;

  const finish = async () => {
    const pending = total - done;
    const msg = pending > 0
      ? tr("Le faltan {p0} ejercicios por marcar. Después de finalizar ya no podrá cambiar sus series ni sus pesos. ¿Finalizar?", { p0: pending })
      : tr("Después de finalizar ya no podrá cambiar sus series ni sus pesos. ¿Finalizar?");
    if (!confirm(msg)) return;
    setFinishing(true);
    const { data, error } = await finishSession(supabase, { userId, weekStart: weekStartISO(), dayLabel: routine.day_label });
    setFinishing(false);
    if (error) return alert(tr("No se pudo finalizar: "));
    setSession(data);
    setJustFinished(true);
    stopRest();
    navigator.vibrate?.([20, 60, 30]);
    // Check-out opcional: se ofrece apenas termina (se puede cerrar con «Ahora no»)
    if (checkoutOn && !checkout) setTimeout(() => setShowCheckout(true), 900);
  };

  // Puntos de series (rutinas por bloques): tocar el siguiente marca esa serie; tocar el último hecho lo desmarca
  const setDots = (ex, i) => {
    // En "lista simple" no se marca por series: en la vista del coach se dibujan igual para tocarlas
    const done = bySet(ex) ? doneOf(ex) : ex.completed ? Array.from({ length: ex.setsCount }, (_, k) => ({ n: k + 1 })) : [];
    const nums = new Set(done.map((d) => d.n));
    const lastDone = done.length ? Math.max(...done.map((d) => d.n)) : 0;
    let nextN = 1;
    while (nums.has(nextN)) nextN++;
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
        {Array.from({ length: ex.setsCount }, (_, k) => {
          const n = k + 1;
          const isDone = nums.has(n);
          // Vista del coach: tocar una serie hecha corrige su peso y reps; una que falta cambia lo planeado
          const coachTap = preview && ((isDone && coachEdit) || (!isDone && onEditExercise));
          const clickable = coachTap || (!preview && !locked && !savingSet && ((isDone && n === lastDone) || (!isDone && n === nextN)));
          return (
            <button
              key={n}
              type="button"
              disabled={!clickable}
              onClick={() => (preview ? (isDone ? setLoggerIndex(i) : onEditExercise(ex)) : isDone ? unmarkLastSet(i) : markNextSet(i))}
              aria-label={preview ? (isDone ? `Corregir serie ${n}` : `Cambiar serie ${n}`) : isDone ? tr("Desmarcar serie {p0}", { p0: n }) : tr("Marcar serie {p0}", { p0: n })}
              className={`w-7 h-7 shrink-0 rounded-full text-[11px] font-semibold flex items-center justify-center transition-all active:scale-90 ${
                isDone ? "bg-accent text-app" : n === nextN && !preview ? "border-2 border-accent/70 text-accent" : "border border-field-strong text-muted"
              } disabled:cursor-default`}
            >
              {isDone ? <Check size={12} strokeWidth={3} /> : n}
            </button>
          );
        })}
        <span className="text-muted text-[11px] ml-1 whitespace-nowrap">
          {done.length >= ex.setsCount ? tr("Series completas") : tr("Serie {p0} de {p1}", { p0: Math.min(done.length + 1, ex.setsCount), p1: ex.setsCount })}
        </span>
      </div>
    );
  };

  // Fila de un ejercicio. Si el coach le dejó una observación, se ve la marca antes de abrirlo.
  const exerciseRow = (ex, i, subtitle) => (
    <div key={i} onClick={() => (preview && onEditExercise ? onEditExercise(ex) : openDetail(i))} className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-2.5 rounded-2xl px-4 py-3 group cursor-pointer transition duration-200 ease-out hover:scale-[1.02] hover:bg-card-hover active:scale-[0.99] ${isEnCurso(ex) ? "bg-accent/15 ring-1 ring-accent/50" : ex.completed ? "bg-card/60" : "bg-card"}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
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
          <p className={`text-sm ${isEnCurso(ex) ? "text-accent font-semibold" : ex.completed ? "text-muted line-through" : "text-ink"}`}>{ex.name}</p>
          {isEnCurso(ex) && <p className="text-accent text-[11px] font-medium">{tr("En curso")}</p>}
          {subtitle && <p className="text-muted text-xs">{subtitle}</p>}
          {(bySet(ex) || (preview && onEditExercise && ex.setsCount > 0)) && setDots(ex, i)}
          {ex.note && (
            <p className="inline-flex items-center gap-1 text-accent text-[11px] font-medium mt-0.5">
              <MessageSquareText size={12} /> {tr("Tiene observación de su coach")}
            </p>
          )}
          {commentOf(ex) && (
            <p className={`flex items-start gap-1 text-[11px] mt-0.5 ${preview ? "text-warning" : "text-soft"}`}>
              <MessageCircle size={12} className="shrink-0 mt-0.5" />
              <span className="line-clamp-2 break-words">{preview ? `Comentario del alumno: ${commentOf(ex)}` : tr("Le dejó un comentario a su coach")}</span>
            </p>
          )}
        </div>
      </div>
      {/* Vista del coach: tocar el ejercicio lo edita. «Observación» va en su propia línea en el celular,
          para que el nombre y las series del ejercicio no queden apretados */}
      {preview && onEditNote && ex.itemKey ? (
        <div className="flex items-center gap-1.5 w-full sm:w-auto pl-10 sm:pl-0">
          {onEditNote && ex.itemKey && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditNote(ex); }}
              className={`flex-1 sm:flex-none justify-center flex items-center gap-1.5 text-xs rounded-lg px-3 py-2 ${ex.note ? "bg-accent/15 text-accent" : "bg-field text-soft hover:text-ink"}`}
            >
              {ex.note ? <Pencil size={13} /> : <MessageSquarePlus size={13} />} Observación
            </button>
          )}
          {ex.note && onDeleteNote && (
            <button onClick={(e) => { e.stopPropagation(); onDeleteNote(ex); }} aria-label="Borrar observación" title="Borrar observación"
              className="shrink-0 w-9 h-9 rounded-lg bg-field text-soft flex items-center justify-center hover:text-danger hover:bg-danger/15">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); openDetail(i); }} aria-label={tr("Ver ejercicio")} className="text-muted transition-colors group-hover:text-ink shrink-0">
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );

  // Reloj programado por el coach (de un bloque, o de toda la rutina en "lista simple")
  // Ejercicios del bloque (o de la rutina en lista simple) para que el reloj diga cuál toca y cuál sigue
  const clockExercisesOf = (part, b) => routine.exercises
    .filter((ex) => (ex.partIndex ?? 0) === (part.partIndex ?? 0) && (b === part || ex.blockId === b.id))
    .map((ex) => ({
      name: ex.name,
      detail: [b === part ? ex.sets : ex.rowLabel, formatWeight(ex.targetWeight, unit)].filter(Boolean).join(" · "),
      // Identidad del ejercicio: con esto el reloj puede dar el bloque por hecho al terminar
      exerciseId: ex.exerciseId,
      itemKey: ex.itemKey,
      routineId: ex.routineId || routine.id,
      setsCount: ex.setsCount,
      byItem: ex.byItem,
      targetWeight: ex.targetWeight,
      targetReps: ex.targetReps,
    }));

  // Indicaciones del coach: las de un bloque, o las del día entero (b === part).
  // El alumno las lee; el coach, mirando la rutina del alumno, las puede escribir con un toque.
  const noteBox = (part, b, texto) => {
    const editable = preview && onEditRoutineNote;
    if (!texto) return null; // vacío: en la vista del coach se escribe desde el menú ⋯
    const esDelDia = b === part;
    const caja = "rounded-xl px-3.5 py-3 mb-3 text-left w-full";
    if (!editable) {
      return (
        <div className={`${caja} bg-accent/10 border border-accent/30`}>
          <p className="text-accent text-xs font-semibold flex items-center gap-1.5 mb-1">
            <MessageSquareText size={14} /> {esDelDia ? tr("Comentario de su coach") : tr("Indicaciones de su coach")}
          </p>
          <p className="text-ink text-sm whitespace-pre-wrap break-words">{texto}</p>
        </div>
      );
    }
    return (
      <div className="relative">
      {texto && onDeleteRoutineNote && (
        <button onClick={() => onDeleteRoutineNote(part, b)} aria-label="Quitar comentario" title="Quitar este comentario (solo para este alumno)"
          className="absolute right-1.5 top-1.5 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-soft hover:text-danger hover:bg-danger/15">
          <Trash2 size={14} />
        </button>
      )}
      <button
        onClick={() => onEditRoutineNote(part, b)}
        className={`${caja} transition-colors ${texto ? "bg-accent/10 border border-accent/30 pr-11" : "bg-field text-soft hover:text-ink"}`}
      >
        <span className={`text-xs font-semibold flex items-center gap-1.5 ${texto ? "text-accent" : "text-soft"}`}>
          <MessageSquareText size={14} />
          {texto
            ? `${esDelDia ? "Comentario del día" : "Indicaciones"}${b.notesCustom ? " · solo este alumno" : ""}`
            : `Escribir ${esDelDia ? "un comentario del día" : "indicaciones"} para este alumno`}
          {!texto && <Pencil size={12} className="ml-auto shrink-0" />}
        </span>
        {texto && <span className="block text-ink text-sm whitespace-pre-wrap break-words mt-1">{texto}</span>}
      </button>
      </div>
    );
  };

  const timerChip = (part, b) => {
    if (preview && onEditTimer) {
      if (!b.timer) return null; // sin reloj: se programa desde el menú ⋯
      return (
        <div className="w-full flex items-center rounded-lg mb-2 text-xs bg-accent/15 text-accent">
          <button onClick={() => onEditTimer(part, b)} className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 text-left hover:text-ink">
            <Timer size={14} className="shrink-0" />
            <span className="flex-1">{`Reloj: ${timerLabel(b.timer)}${b.timerCustom ? " · solo este alumno" : ""}`}</span>
            <Pencil size={12} className="shrink-0" />
          </button>
          {b.timer && onRemoveTimer && (
            <button onClick={() => onRemoveTimer(part, b)} aria-label="Quitar reloj" title="Quitar reloj (solo para este alumno)" className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-danger/15 hover:text-danger">
              <X size={15} />
            </button>
          )}
        </div>
      );
    }
    if (!b.timer) return null;
    return (
      <button onClick={() => openClock({ preset: b.timer, exercises: clockExercisesOf(part, b), dayLabel: routine.day_label, fromRoutine: !preview })} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-2 bg-accent/15 border border-accent/30 text-left active:scale-[0.99] transition-transform">
        <span className="w-8 h-8 rounded-lg bg-accent text-app flex items-center justify-center shrink-0"><Timer size={16} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-ink text-sm font-medium">{timerLabel(b.timer, tr)}</span>
          <span className="block text-muted text-[11px]">{tr("Reloj programado por su coach · tocar para abrir")}</span>
        </span>
        <ChevronRight size={16} className="text-accent shrink-0" />
      </button>
    );
  };

  // "+ Agregar ejercicio" al final de un bloque (o de la lista): entra después del último
  const addExerciseButton = (lastEx) => (
    <button onClick={() => onAddExercise(lastEx)} className="w-full border border-dashed border-field-strong text-soft text-xs rounded-xl py-2.5 flex items-center justify-center gap-1.5 hover:text-accent hover:border-accent/50">
      <Plus size={13} /> Agregar ejercicio
    </button>
  );

  // Un bloque de la rutina. handleProps = agarradera ⋮⋮ para arrastrarlo (vista del coach)
  const blockSection = (part, b, handleProps) => {
                      const items = routine.exercises.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.partIndex === part.partIndex && ex.blockId === b.id);
                      const doneCount = items.filter(({ ex }) => ex.completed).length;
                      const round = blockRound(items);
                      return (
                        <section key={b.id}>
                          <div className="flex items-end justify-between gap-3 mb-2">
                            {handleProps && <DragHandle {...handleProps} onKeyMove={(dir) => { const at = part.blocks.indexOf(b); const to = at + dir; if (to >= 0 && to < part.blocks.length) onMoveBlock(part, at, to); }} label="Mover bloque (arrastre o use las flechas ↑ ↓)" className="self-center -ml-1" />}
                            <div className="min-w-0 flex-1">
                              {b.title && b.title !== blockTypeLabel(b.block_type) && (
                                <p className="text-accent text-[10px] uppercase tracking-wider">{tr(blockTypeLabel(b.block_type))}</p>
                              )}
                              <h2 className="text-ink text-base font-semibold truncate">{b.title && b.title !== blockTypeLabel(b.block_type) ? b.title : tr(blockTypeLabel(b.block_type))}</h2>
                            </div>
                            {(() => {
                              const setsText = round ? (
                                <p className={`text-sm font-medium ${round.finished ? "text-accent" : "text-ink"}`}>
                                  {round.finished ? tr("Bloque completo") : tr("Serie {p0} de {p1}", { p0: round.current, p1: round.total })}
                                </p>
                              ) : (
                                b.sets && <p className="text-ink text-sm font-medium">{b.sets} {tr("series")}</p>
                              );
                              const done = items.length > 0 && <p className="text-muted text-[11px]">{doneCount}/{items.length} {tr("hechos")}</p>;
                              // Vista del coach: tocar "Serie 1 de 3" cambia las series del bloque
                              return preview && onEditBlockSets && items.length > 0 ? (
                                <button onClick={() => onEditBlockSets(part, b, items.map(({ ex }) => ex))} title="Cambiar las series de este bloque"
                                  className="text-right shrink-0 rounded-lg px-2 py-1 -mr-1 hover:bg-field group/sets">
                                  <span className="flex items-center justify-end gap-1">{setsText || <span className="text-soft text-sm">{tr("Series")}</span>}<Pencil size={12} className="text-accent" /></span>
                                  {done}
                                </button>
                              ) : (
                                <div className="text-right shrink-0">{setsText}{done}</div>
                              );
                            })()}
                            {preview && (
                              <MenuButton className="self-center" label="Opciones del bloque" actions={[
                                onEditRoutineNote && { label: b.notes ? "Editar indicaciones" : "Escribir indicaciones", icon: MessageSquareText, onClick: () => onEditRoutineNote(part, b) },
                                onEditTimer && !b.timer && { label: "Programar reloj", icon: Timer, onClick: () => onEditTimer(part, b) },
                                onDuplicateBlock && { label: "Duplicar bloque", icon: Copy, onClick: () => onDuplicateBlock(part, b) },
                                onDeleteBlock && { label: "Quitar bloque", icon: Trash2, onClick: () => onDeleteBlock(part, b), danger: true },
                              ]} />
                            )}
                          </div>
                          {noteBox(part, b, b.notes)}
                          {timerChip(part, b)}
                          <div className="space-y-2">
                            {items.map(({ ex, i }) => exerciseRow(ex, i, [ex.rowLabel, formatWeight(ex.targetWeight, unit)].filter(Boolean).join(" · ")))}
                            {preview && onAddExercise && items.length > 0 && addExerciseButton(items[items.length - 1].ex)}
                          </div>
                        </section>
                      );
  };

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      {showCheckout && !preview && (
        <CheckoutSheet
          userId={userId}
          weekStart={weekStartISO()}
          dayLabel={routine.day_label}
          exercises={routine.exercises}
          initial={checkout}
          onClose={() => setShowCheckout(false)}
          onSaved={(row) => setCheckout(row)}
        />
      )}
      {celebrate && <Confetti onDone={() => setTimeout(() => setCelebrate(false), pet ? 2800 : 1200)} />}
      {celebrate && (
        <div className="fixed inset-x-0 top-1/3 z-[61] flex justify-center px-6 pointer-events-none">
          <div className="animate-celebrate bg-panel border border-accent/30 rounded-3xl px-6 py-5 text-center shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)]">
            {pet ? (
              <Chameleon mine mood={5} size={120} party className="mx-auto" />
            ) : (
              <p className="text-3xl mb-1">🎉</p>
            )}
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
          <div className="flex items-center gap-2">
            {!preview && (
              <button onClick={() => openClock({ initialMode: tabataByDefault ? "tabata" : undefined, fromRoutine: true })} className="flex items-center gap-1.5 h-9 rounded-full bg-accent text-app px-3.5 text-xs font-semibold active:scale-95 transition-transform">
                <Timer size={14} /> {tr("Reloj")}
              </button>
            )}
            <button onClick={downloadPdf} disabled={pdfBusy} className="flex items-center gap-1.5 h-9 rounded-full bg-app/50 border border-white/[0.06] px-3 text-soft text-xs disabled:opacity-60">
              <Download size={14} /> {pdfBusy ? tr("Generando...") : "PDF"}
            </button>
          </div>
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
        {locked && (
          <p className="flex items-center gap-2 bg-card border border-white/[0.06] text-soft text-xs rounded-xl px-3 py-2.5 mb-4">
            <Lock size={14} className="text-accent shrink-0" /> {tr("Entrenamiento finalizado: solo lectura.")}
          </p>
        )}
        {!preview && session?.finished_at && session.unlocked_at && (
          <p className="bg-accent/10 border border-accent/30 text-ink text-xs rounded-xl px-3 py-2.5 mb-4">
            {tr("Su coach habilitó la edición. Cuando termine de corregir, toque «Finalizar entrenamiento».")}
          </p>
        )}

        <div className="space-y-8">
          {(routine.parts || [routine]).map((part, partIdx, allParts) => {
            const partItems = routine.exercises.filter((ex) => (ex.partIndex ?? 0) === (part.partIndex ?? 0));
            const partDone = partItems.filter((ex) => ex.completed).length;
            return (
              <div key={`${part.id}-${partIdx}`}>
                {(allParts.length > 1 || part.isExtra || (preview && onDeletePart)) && (
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b border-field">
                    <span className="w-7 h-7 rounded-full bg-accent text-app text-xs font-semibold flex items-center justify-center shrink-0">{partIdx + 1}</span>
                    <div className="flex-1 min-w-0">
                      {part.isExtra && <p className="text-accent text-[10px] font-semibold uppercase tracking-wider">{tr("Extra")}</p>}
                      <h2 className="text-ink text-lg font-semibold truncate">{part.title}</h2>
                      <p className="text-muted text-xs">{[part.duration_minutes ? `${part.duration_minutes} ${tr("min")}` : "", `${partDone}/${partItems.length} ${tr("hechos")}`].filter(Boolean).join(" · ")}</p>
                    </div>
                    {preview && (
                      <MenuButton label={`Opciones de ${part.title}`} actions={[
                        onEditRoutineNote && { label: part.dayNote ? "Editar comentario del día" : "Comentario del día", icon: MessageSquareText, onClick: () => onEditRoutineNote(part, part) },
                        onEditTimer && !(part.blocks?.length > 0) && !part.timer && { label: "Programar reloj", icon: Timer, onClick: () => onEditTimer(part, part) },
                        onAddBlock && part.blocks?.length > 0 && { label: "Agregar bloque", icon: Plus, onClick: () => onAddBlock(part) },
                        onDeletePart && { label: "Quitar del día", icon: Trash2, onClick: () => onDeletePart(part), danger: true },
                      ]} />
                    )}
                  </div>
                )}
                {/* Comentario del día: lo primero que lee el alumno al abrir su rutina */}
                {noteBox(part, part, part.dayNote)}
                {part.blocks?.length > 0 ? (
                  preview && onMoveBlock ? (
                    <SortableList ids={part.blocks.map((b) => `${part.partIndex ?? 0}-${b.id}`)} onMove={(from, to) => onMoveBlock(part, from, to)} className="space-y-5">
                      {part.blocks.map((b) => (
                        <SortableRow key={b.id} id={`${part.partIndex ?? 0}-${b.id}`}>
                          {(handleProps) => blockSection(part, b, handleProps)}
                        </SortableRow>
                      ))}
                    </SortableList>
                  ) : (
                  <div className="space-y-5">
                    {part.blocks.map((b) => blockSection(part, b, null))}
                  </div>
                  )
                ) : (
                  <>
                    {timerChip(part, part)}
                    <div className="space-y-2">
                      {routine.exercises.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.partIndex === part.partIndex).map(({ ex, i }) => exerciseRow(ex, i, ex.sets))}
                      {preview && onAddExercise && partItems.length > 0 && addExerciseButton(partItems[partItems.length - 1])}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {!preview && (locked ? (
          <div className="bg-card border border-accent/30 rounded-2xl p-4 mt-6 text-center">
            {pet && (
              <>
                <Chameleon mine mood={5} size={170} party={justFinished} className="mx-auto" />
                <p className="text-ink text-base font-semibold mt-1">{tr("¡Lo logramos!")}</p>
                <p className="text-soft text-xs mb-2">{tr("{p0} está orgulloso de usted.", { p0: pet.name || tr("Su camaleón") })}</p>
              </>
            )}
            <p className="text-accent text-sm font-semibold flex items-center justify-center gap-1.5"><Check size={16} strokeWidth={3} /> {tr("Entrenamiento finalizado")}</p>
            <p className="text-muted text-xs mt-1">{fmtFinished(session.finished_at, appLocale())}</p>
            <p className="text-soft text-xs mt-2">{tr("Ya no se pueden cambiar las series ni los pesos. Si necesita corregir algo, pídale a su coach que habilite la edición.")}</p>
            {checkoutOn && (
              <button onClick={() => setShowCheckout(true)} className={`block w-full text-sm py-3 rounded-xl mt-3 ${checkout ? "bg-white/[0.04] text-soft" : "bg-accent/15 border border-accent/30 text-accent font-semibold"}`}>
                {checkout ? (checkout.had_issue ? tr("Check-out enviado (con molestias) · Editar") : tr("Check-out enviado · Editar")) : tr("Hacer check-out: ¿le molestó algo?")}
              </button>
            )}
            <button onClick={onClose} className="block w-full bg-field text-ink font-medium text-sm py-3 rounded-xl mt-3">{tr("Volver al inicio")}</button>
          </div>
        ) : (
          <>
            <button onClick={finish} disabled={finishing} className="block w-full bg-accent text-app font-semibold py-3.5 rounded-2xl mt-6 active:scale-[0.98] transition-transform disabled:opacity-60">
              {finishing ? tr("Guardando...") : tr("Finalizar entrenamiento")}
            </button>
            <InfoNote className="mt-2 justify-center" text={tr("Al finalizar, el entrenamiento de hoy queda cerrado y ya no se puede modificar.")} />
          </>
        ))}
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
            {!preview && (
              <ExerciseCommentBox key={cKey(detail)} exercise={detail} routineId={detail.routineId || routine.id} dayLabel={routine.day_label} userId={userId}
                value={commentOf(detail)} onSaved={(text) => setCommentOf(detail, text)} />
            )}
            {preview && commentOf(detail) && (
              <div className="bg-warning/10 border border-warning/30 rounded-xl px-3.5 py-3 mb-4">
                <p className="text-warning text-xs font-semibold flex items-center gap-1.5 mb-1"><MessageCircle size={14} /> Comentario del alumno</p>
                <p className="text-ink text-sm whitespace-pre-wrap break-words">{commentOf(detail)}</p>
              </div>
            )}
            {preview && onEditExercise && (
              <button onClick={() => { const d = detail; closeDetail(); onEditExercise(d); }} className="w-full mb-2 flex items-center justify-center gap-1.5 bg-field text-ink text-sm rounded-xl py-2.5 hover:bg-field-hover">
                <SlidersHorizontal size={14} /> Editar peso, series, reps o ejercicio
              </button>
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
            {((!preview && (bySet(detail) || locked)) || (preview && coachEdit)) && (
              <button onClick={() => { const i = detailIndex; closeDetail(); setLoggerIndex(i); }} className="w-full mb-4 flex items-center justify-center gap-1.5 bg-field text-ink text-sm rounded-xl py-2.5 hover:bg-field-hover">
                <SquarePen size={14} /> {preview ? "Corregir peso y reps de cada serie" : locked ? tr("Ver peso y reps de cada serie") : tr("Anotar peso y reps de cada serie")}
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

      {(!preview || coachEdit) && loggerIndex !== null && (
        <SetLogger
          key={loggerIndex}
          readOnly={locked}
          coachMode={preview}
          onCorrected={preview ? loadSets : null}
          pet={preview ? null : pet}
          exercise={routine.exercises[loggerIndex]}
          routine={routine}
          userId={userId}
          onClose={() => { setLoggerIndex(null); loadSets(); }}
          onComplete={(w) => completeExercise(loggerIndex, w)}
          onUncomplete={() => uncompleteExercise(loggerIndex)}
          onStartRest={startRest}
          comment={commentOf(routine.exercises[loggerIndex])}
          onCommentSaved={(text) => setCommentOf(routine.exercises[loggerIndex], text)}
        />
      )}
      {pdfPreview}
    </div>
  );
}
