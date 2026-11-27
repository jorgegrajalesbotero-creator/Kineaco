"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Calendar, ChevronLeft, ChevronRight, Copy, Eye, Lock, LockOpen, PlusCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { WEEK_DAYS, todayDayLabel } from "@/lib/dates";
import { addDays, loadSchedule, mondayOf, routinesForDate } from "@/lib/trainingPlan";
import { buildDay } from "@/lib/studentRoutine";
import { saveExerciseNote } from "@/lib/exerciseNotes";
import { fmtFinished, isLocked, loadSession, setSessionUnlocked, weekStartISO } from "@/lib/workoutSession";
import { RoutineScreen } from "@/components/student/RoutineScreen";
import { Skeleton } from "@/components/ui/Skeleton";
import { PanelLayout } from "./PanelLayout";
import { ExerciseNoteEditor } from "./ExerciseNoteEditor";
import { ExerciseEditSheet } from "./ExerciseEditSheet";
import { BlockSetsSheet } from "./BulkSetsSheet";
import { CheckoutSummary } from "./CheckoutSummary";
import { loadCheckout } from "@/lib/checkout";
import { TimerOverrideEditor } from "./TimerOverrideEditor";
import { saveStudentTimer } from "@/lib/routineTimers";
import { RoutineNoteEditor } from "./RoutineNoteEditor";
import { NOTE_OFF, ROUTINE_NOTE_INDEX, saveStudentNote } from "@/lib/routineNotes";
import { blockTypeLabel } from "@/lib/blocks";
import { localDateString } from "@/lib/dates";
import { arrayMove } from "@/components/ui/Sortable";
import { movedOrder } from "@/lib/previewEdits";
import { addBlock, copyDay, deleteBlock, deletePart, duplicateBlock, removeRoutineNote, removeTimer, reorderBlocks } from "./blockEdits";
import { AddBlockSheet, CopyDaySheet } from "./PreviewSheets";
import { useUndo } from "@/components/ui/UndoToast";
import { ScopeAskSheet } from "./ScopeAskSheet";

import { InfoTip } from "@/components/ui/InfoTip";
const DAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
const fmtDay = (d) => d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });

// Copia un objeto conservando sus "getters" (las etiquetas de series/reps de cada ejercicio)
const cloneWith = (obj, patch) => Object.assign(Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj)), patch);

// El coach ve la rutina de un día tal como la ve el alumno (con su plan, cargas y cambios de esa semana)
// y le deja observaciones por ejercicio. No cambia la rutina ni la planeación.
export function RoutinePreviewPanel({ student, onClose, onOpenPanel }) {
  const [schedule, setSchedule] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [day, setDay] = useState(todayDayLabel());
  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // ejercicio al que se le escribe la observación
  const [editingEx, setEditingEx] = useState(null); // ejercicio que se edita (peso, series, reps, cambiarlo)
  const [blockSets, setBlockSets] = useState(null); // { part, block, exercises }: tocar "Serie 1 de 3" en un bloque
  const [editingTimer, setEditingTimer] = useState(null); // { part, block } reloj solo para este alumno
  const [editingNote, setEditingNote] = useState(null); // { part, block } comentario solo para este alumno (block === part: el del día)
  const [session, setSession] = useState(null); // ¿el alumno ya finalizó este día?
  const [checkout, setCheckout] = useState(null); // check-out del alumno ese día (molestias, esfuerzo, comentario)
  const [sessionBusy, setSessionBusy] = useState(false);
  const [ask, setAsk] = useState(null); // pregunta antes de quitar o mover: { title, message, scoped, confirmLabel, danger, action, cancel }
  const [editBusy, setEditBusy] = useState(false);
  const [addingEx, setAddingEx] = useState(null); // "+ Agregar ejercicio": el último del bloque (va después)
  const [addingBlock, setAddingBlock] = useState(null); // "+ Agregar bloque": la rutina del día
  const [copyOpen, setCopyOpen] = useState(false); // "Copiar este día a…"
  const { offer: offerUndo, toast: undoToast } = useUndo(8000); // "Se quitó … · Deshacer"
  // En vivo: cuando el alumno marca una serie, un ejercicio o finaliza, la vista se actualiza sola
  const [liveTick, setLiveTick] = useState(0);
  const [liveOn, setLiveOn] = useState(false);
  const [lastActivity, setLastActivity] = useState(null); // { at: Date, day }
  const view = useRef({});
  useEffect(() => { view.current = { schedule, day, weekOffset }; });
  const reloadTimer = useRef(null);

  async function loadWeekSchedule() {
    setSchedule(await loadSchedule(supabase, student.id, "*"));
  }
  useEffect(() => { loadWeekSchedule(); }, [student.id]);

  async function loadRoutine(sched, d, offset) {
    setLoading(true);
    try {
      const [r, s, co] = await Promise.all([
        buildDay(supabase, student.id, d, { weekOffset: offset, schedule: sched }),
        loadSession(supabase, student.id, weekStartISO(offset), d),
        loadCheckout(supabase, student.id, weekStartISO(offset), d),
      ]);
      setRoutine(r);
      setSession(s);
      setCheckout(co.data);
    } catch {
      setRoutine(null);
      setSession(null);
      setCheckout(null);
    }
    setLoading(false);
  }

  // Recarga sin mostrar "cargando" (para no hacer parpadear la pantalla en cada serie)
  async function silentReload() {
    const { schedule: sched, day: d, weekOffset: offset } = view.current;
    if (!sched) return;
    try {
      const [r, s, co] = await Promise.all([
        buildDay(supabase, student.id, d, { weekOffset: offset, schedule: sched }),
        loadSession(supabase, student.id, weekStartISO(offset), d),
        loadCheckout(supabase, student.id, weekStartISO(offset), d),
      ]);
      setRoutine(r);
      setSession(s);
      setCheckout(co.data);
      setLiveTick((t) => t + 1);
    } catch {
      // sin conexión: se intenta en el próximo cambio
    }
  }
  const queueReload = () => {
    clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(silentReload, 350);
  };

  useEffect(() => {
    if (weekOffset !== 0) return undefined;
    const own = (payload) => {
      const row = payload.new && Object.keys(payload.new).length ? payload.new : null;
      if (row && row.user_id !== student.id) return;
      if (row) setLastActivity({ at: new Date(), day: row.day_label || null });
      queueReload();
    };
    const mine = { schema: "public", filter: `user_id=eq.${student.id}` };
    const channel = supabase
      .channel(`envivo-${student.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", table: "progress_sets", ...mine }, own)
      .on("postgres_changes", { event: "UPDATE", table: "progress_sets", ...mine }, own)
      .on("postgres_changes", { event: "INSERT", table: "progress", ...mine }, own)
      .on("postgres_changes", { event: "INSERT", table: "workout_sessions", ...mine }, own)
      .on("postgres_changes", { event: "UPDATE", table: "workout_sessions", ...mine }, own)
      .on("postgres_changes", { event: "INSERT", table: "workout_checkouts", ...mine }, own)
      .on("postgres_changes", { event: "UPDATE", table: "workout_checkouts", ...mine }, own)
      .on("postgres_changes", { event: "INSERT", table: "student_exercise_comments", ...mine }, own)
      .on("postgres_changes", { event: "UPDATE", table: "student_exercise_comments", ...mine }, own)
      // Los borrados (desmarcar) no se pueden filtrar por alumno: se recarga y listo
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "progress_sets" }, own)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "progress" }, own)
      .subscribe((status) => setLiveOn(status === "SUBSCRIBED"));
    // Respaldo por si el tiempo real no está activo: revisa cada 20 s con la pantalla visible
    const poll = setInterval(() => { if (document.visibilityState === "visible") silentReload(); }, 20000);
    return () => {
      clearInterval(poll);
      clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
      setLiveOn(false);
    };
  }, [student.id, weekOffset]);

  const toggleLock = async () => {
    if (!session) return;
    setSessionBusy(true);
    const { data, error } = await setSessionUnlocked(supabase, session.id, isLocked(session));
    setSessionBusy(false);
    if (error) return alert("No se pudo cambiar. Revisá que el SQL de «Finalizar entrenamiento» esté aplicado en Supabase.");
    setSession(data);
  };

  // El coach corrigió una serie: se actualiza el "hecho" del ejercicio en la vista
  const onToggle = (i, value) =>
    setRoutine((r) => cloneWith(r, { exercises: r.exercises.map((e, idx) => (idx === i ? cloneWith(e, { completed: value }) : e)) }));
  useEffect(() => { if (schedule) loadRoutine(schedule, day, weekOffset); }, [schedule, day, weekOffset]);

  const monday = addDays(mondayOf(new Date()), weekOffset * 7);
  const weekDays = schedule
    ? WEEK_DAYS.map((label, i) => {
        const date = addDays(monday, i);
        const info = routinesForDate(schedule.plans, schedule.fixed, date, schedule.extras);
        return { label, date, count: info.items.length, plan: info.plan, planWeek: info.week };
      })
    : [];
  const withPlan = weekDays.find((x) => x.plan);
  const week = { days: weekDays, plan: withPlan?.plan || null, planWeek: withPlan?.planWeek || null };

  const weekTitle = weekOffset === 0 ? "Esta semana" : weekOffset === 1 ? "Semana siguiente" : weekOffset === -1 ? "Semana pasada" : `Semana del ${fmtDay(monday)}`;

  const saveNote = async (text) => {
    const ex = editing;
    const routineId = ex.routineId || routine.id;
    const { error } = await saveExerciseNote(supabase, { userId: student.id, routineId, itemKey: ex.itemKey, exerciseId: ex.exerciseId, note: text });
    if (error) {
      alert("No se pudo guardar la observación. Si es la primera vez, revisá que el SQL de observaciones esté aplicado en Supabase.");
      return false;
    }
    const note = text.trim() || null;
    setRoutine((r) => cloneWith(r, {
      exercises: r.exercises.map((e) =>
        String(e.routineId || r.id) === String(routineId) && String(e.itemKey) === String(ex.itemKey) && String(e.exerciseId) === String(ex.exerciseId) ? cloneWith(e, { note }) : e
      ),
    }));
    return true;
  };

  // Comentario de un bloque, o del día entero, solo para este alumno
  const saveRoutineNote = async (text) => {
    const { part, block } = editingNote;
    const index = block === part ? ROUTINE_NOTE_INDEX : block.blockIndex;
    const error = await saveStudentNote(supabase, student.id, part.id, index, text);
    if (error) {
      alert("No se pudo guardar el comentario. Si es la primera vez, revisá que el SQL de comentarios de rutina esté aplicado en Supabase.");
      return false;
    }
    loadRoutine(schedule, day, weekOffset);
    return true;
  };

  const saveTimer = async (timer) => {
    const { part, block } = editingTimer;
    const error = await saveStudentTimer(supabase, student.id, part.id, block.blockIndex, timer);
    if (error) {
      alert("No se pudo guardar el reloj. Si es la primera vez, revisá que el SQL del reloj programado esté aplicado en Supabase.");
      return false;
    }
    loadRoutine(schedule, day, weekOffset);
    return true;
  };

  // ---------- Quitar y mover bloques, relojes y rutinas del día (solo para este alumno) ----------
  const dayInfo = week.days.find((d) => d.label === day) || null;
  const editCtx = (part, scope) => ({ studentId: student.id, part, dayLabel: day, plan: dayInfo?.plan || null, planWeek: dayInfo?.planWeek || null, scope, schedule });
  // Guarda, y vuelve a leer todo (si algo falla, la vista queda como está guardado de verdad).
  // undoLabel = si el cambio se puede deshacer, el aviso que se muestra unos segundos con "Deshacer".
  const runEdit = async (fn, undoLabel = null) => {
    setEditBusy(true);
    let res = null;
    try {
      res = await fn();
    } catch (e) {
      alert(e?.message || "No se pudo guardar el cambio.");
    }
    await loadWeekSchedule();
    setEditBusy(false);
    if (undoLabel && typeof res?.undo === "function") offerUndo(undoLabel, () => runEdit(res.undo));
  };
  // whole = se quita la rutina entera del día (en un extra, solo de este día de la semana)
  const scopeNote = (part, whole = false) =>
    part.isExtra ? (whole ? "Es un extra: se quita de este día de la semana." : "Es un extra: el cambio vale para todos los días de ese extra.")
      : dayInfo?.plan ? `Va a su planeación (semana ${dayInfo.planWeek}). La rutina de la biblioteca no cambia.`
        : "No tiene planeación: el cambio queda en su semana base (todas las semanas). La rutina de la biblioteca no cambia.";
  const isScoped = (part) => part.isExtra || !!dayInfo?.plan;

  const askDeletePart = (part) => setAsk({
    title: `¿Quitar «${part.title}» del ${day}?`,
    message: scopeNote(part, true),
    scoped: isScoped(part),
    action: (scope) => runEdit(() => deletePart({ ...editCtx(part, scope), mondayISO: localDateString(monday) }), `Se quitó «${part.title}»`),
  });

  const askDeleteBlock = (part, b) => {
    if ((part.blocks || []).length <= 1) return askDeletePart(part); // era el único bloque: se quita la rutina
    const name = b.title || blockTypeLabel(b.block_type);
    setAsk({
      title: `¿Quitar el bloque «${name}»?`,
      message: `Se quita con sus ejercicios, solo para este alumno. ${scopeNote(part)}`,
      scoped: isScoped(part) && !part.isExtra,
      action: (scope) => runEdit(() => deleteBlock(editCtx(part, scope), b.blockIndex), `Se quitó el bloque «${name}»`),
    });
  };

  // Arrastrar un bloque: se ve movido al instante y, si hay planeación, se pregunta hasta cuándo
  const moveBlock = (part, from, to) => {
    if (editBusy || from === to) return;
    const order = movedOrder(part.blocks.map((b) => b.blockIndex), from, to);
    setRoutine((r) => {
      const blocks = arrayMove(part.blocks, from, to);
      if (!r.parts) return cloneWith(r, { blocks });
      return cloneWith(r, { parts: r.parts.map((p) => ((p.partIndex ?? 0) === (part.partIndex ?? 0) ? cloneWith(p, { blocks }) : p)) });
    });
    const save = (scope) => runEdit(() => reorderBlocks(editCtx(part, scope), order), "Se cambió el orden de los bloques");
    if (isScoped(part) && !part.isExtra) {
      setAsk({ title: "¿Hasta cuándo va este orden?", message: scopeNote(part), scoped: true, danger: false, action: save, cancel: () => loadRoutine(schedule, day, weekOffset) });
    } else {
      save("all");
    }
  };

  // Quitar un comentario (del día o de un bloque) solo para este alumno. Si venía de la rutina, se le apaga.
  const askDeleteRoutineNote = (part, b) => {
    const delDia = b === part;
    setAsk({
      title: delDia ? "¿Quitar el comentario del día?" : "¿Quitar el comentario de este bloque?",
      message: !delDia && b.notesBase ? "Se le quita solo a este alumno; la rutina lo conserva para los demás." : "Es un comentario solo de este alumno.",
      scoped: false,
      action: () => runEdit(
        () => removeRoutineNote(student.id, part, delDia ? ROUTINE_NOTE_INDEX : b.blockIndex, !delDia && b.notesBase ? NOTE_OFF : ""),
        "Se quitó el comentario",
      ),
    });
  };

  // Borrar la observación de un ejercicio
  const askDeleteNote = (ex) => setAsk({
    title: `¿Borrar la observación de «${ex.name}»?`,
    message: "El alumno deja de verla.",
    scoped: false,
    action: () => runEdit(async () => {
      const target = { userId: student.id, routineId: ex.routineId || routine.id, itemKey: ex.itemKey, exerciseId: ex.exerciseId };
      const before = ex.note || "";
      const { error } = await saveExerciseNote(supabase, { ...target, note: "" });
      if (error) throw new Error("No se pudo borrar la observación.");
      return { undo: async () => { const r = await saveExerciseNote(supabase, { ...target, note: before }); if (r.error) throw new Error("No se pudo deshacer."); } };
    }, "Se borró la observación"),
  });

  // Duplicar un bloque justo debajo (solo para este alumno)
  const askDuplicateBlock = (part, b) => {
    const name = b.title || blockTypeLabel(b.block_type);
    const go = (scope) => runEdit(() => duplicateBlock(editCtx(part, scope), b.blockIndex), `Se duplicó el bloque «${name}»`);
    if (isScoped(part) && !part.isExtra) setAsk({ title: `¿Duplicar «${name}»?`, message: scopeNote(part), scoped: true, danger: false, action: go });
    else go("all");
  };

  // "Copiar este día a…": los otros días de esta semana y, con planeación, el mismo día de la semana siguiente
  const nonExtraCount = (date) => {
    if (!schedule) return 0;
    return routinesForDate(schedule.plans, schedule.fixed, date, []).items.length;
  };
  const dayIndex = WEEK_DAYS.indexOf(day);
  const copyTargets = schedule ? [
    ...WEEK_DAYS.map((label, i) => ({ key: label, label, day: label, week: dayInfo?.planWeek || null, hasRoutines: nonExtraCount(addDays(monday, i)) > 0 })).filter((t) => t.day !== day),
    ...(dayInfo?.plan && dayInfo.planWeek < dayInfo.plan.weeks
      ? [{ key: "next", label: `${day} de la semana siguiente`, day, week: dayInfo.planWeek + 1, wide: true, hasRoutines: nonExtraCount(addDays(monday, dayIndex + 7)) > 0 }]
      : []),
  ] : [];
  const canCopyDay = schedule && dayIndex >= 0 && nonExtraCount(addDays(monday, dayIndex)) > 0;
  const doCopyDay = async (target, mode) => {
    await runEdit(
      () => copyDay({ studentId: student.id, plan: dayInfo?.plan || null, from: { week: dayInfo?.planWeek || null, day }, to: { week: target.week, day: target.day }, mode }),
      `Se copió el ${day.toLowerCase()} al ${target.label.toLowerCase()}`,
    );
    return true;
  };

  const askRemoveTimer = (part, b) => setAsk({
    title: "¿Quitar el reloj de este bloque?",
    message: b.timerBase ? "Se le quita solo a este alumno; la rutina lo conserva para los demás." : "Es un reloj solo de este alumno.",
    scoped: false,
    action: () => runEdit(() => removeTimer(student.id, part, b), "Se quitó el reloj"),
  });

  return (
    <PanelLayout title="Rutina como la ve el alumno" subtitle={student.isSelf ? "Mi entrenamiento" : student.name} onClose={onClose} width="max-w-2xl">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-muted text-xs flex items-center gap-1.5 mr-auto">
          <Eye size={14} /> Así la ve el alumno
          <InfoTip text={"Con su plan, cargas y cambios de esa semana. Todo lo que cambies aquí es solo para este alumno.\n\n• Tocá un ejercicio o una serie para cambiar peso, series, reps o el ejercicio.\n• Tocá «Serie 1 de 3» de un bloque para cambiar sus series.\n• ⋮⋮ arrastra un bloque; ⋯ tiene indicaciones, reloj, duplicar y quitar.\n• Las series las marca el alumno; las hechas se corrigen tocándolas (semana actual)."} />
        </span>
        <button onClick={() => onOpenPanel?.("plan")} className="bg-card text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink">
          <Calendar size={13} /> Planeación
        </button>
        <button onClick={() => onOpenPanel?.("days")} className="bg-card text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink">
          <Activity size={13} /> Semana base
        </button>
        <button onClick={() => onOpenPanel?.("extras")} className="bg-card text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink">
          <PlusCircle size={13} /> Extras
        </button>
      </div>

      <div className="bg-card rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <button onClick={() => setWeekOffset((w) => w - 1)} aria-label="Semana anterior" className="w-8 h-8 rounded-full bg-field text-soft flex items-center justify-center hover:text-ink">
            <ChevronLeft size={16} />
          </button>
          <div className="text-center min-w-0">
            <p className="text-ink text-sm font-medium">{weekTitle}</p>
            <p className="text-muted text-[11px] truncate">
              {fmtDay(monday)} – {fmtDay(addDays(monday, 6))} · {week.plan ? `${week.plan.name || "Plan"} · semana ${week.planWeek} de ${week.plan.weeks}` : "Semana base (sin plan)"}
            </p>
          </div>
          <button onClick={() => setWeekOffset((w) => w + 1)} aria-label="Semana siguiente" className="w-8 h-8 rounded-full bg-field text-soft flex items-center justify-center hover:text-ink">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {week.days.map((d, i) => {
            const on = d.label === day;
            return (
              <button key={d.label} onClick={() => setDay(d.label)} aria-label={d.label}
                className={`rounded-lg py-1.5 flex flex-col items-center ${on ? "bg-accent text-app" : "bg-field text-soft hover:text-ink"}`}>
                <span className="text-[11px] font-semibold">{DAY_SHORT[i]}</span>
                <span className="text-[10px]">{d.date.getDate()}</span>
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${d.count > 0 ? (on ? "bg-app" : "bg-accent") : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      </div>

      {loading || !schedule ? (
        <Skeleton rows={4} />
      ) : !routine ? (
        <p className="text-muted text-sm bg-card rounded-xl p-4">{day}: día de descanso, no tiene rutina asignada.</p>
      ) : (
        <>
          <div className="bg-card rounded-xl px-3.5 py-3 mb-3 flex flex-wrap items-center justify-between gap-2">
            {!session?.finished_at ? (
              <p className="text-muted text-xs">Sin finalizar: el alumno todavía puede marcar y cambiar este día.</p>
            ) : isLocked(session) ? (
              <p className="text-ink text-xs flex items-center gap-1.5"><Lock size={13} className="text-accent" /> Finalizado el {fmtFinished(session.finished_at)} · el alumno ya no puede cambiarlo</p>
            ) : (
              <p className="text-ink text-xs flex items-center gap-1.5"><LockOpen size={13} className="text-warning" /> Edición habilitada: el alumno puede corregir y volver a finalizar</p>
            )}
            {session?.finished_at && (
              <button onClick={toggleLock} disabled={sessionBusy} className={`text-xs rounded-lg px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50 ${isLocked(session) ? "bg-field text-ink hover:bg-field-hover" : "bg-accent text-app font-semibold"}`}>
                {isLocked(session) ? <><LockOpen size={12} /> Habilitar edición</> : <><Lock size={12} /> Volver a bloquear</>}
              </button>
            )}
          </div>
          {weekOffset === 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 ${liveOn ? "bg-accent/15 text-accent" : "bg-field text-soft"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${liveOn ? "bg-accent animate-pulse" : "bg-muted"}`} />
                {liveOn ? "En vivo" : "Se actualiza cada 20 s"}
              </span>
              {lastActivity && (
                <span className="text-muted text-[11px]">
                  Última actividad {lastActivity.at.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}
                  {lastActivity.day && lastActivity.day !== day ? ` · está entrenando el ${lastActivity.day}` : ""}
                </span>
              )}
              {lastActivity?.day && lastActivity.day !== day && (
                <button onClick={() => setDay(lastActivity.day)} className="text-accent text-[11px] font-semibold">Ver ese día</button>
              )}
            </div>
          )}
          {checkout && <div className="mb-3"><CheckoutSummary checkout={checkout} title="Check-out de este día" /></div>}
          {canCopyDay && (
            <div className="flex justify-end mb-2">
              <button onClick={() => setCopyOpen(true)} className="bg-card text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink">
                <Copy size={13} /> Copiar este día a…
              </button>
            </div>
          )}
          {editBusy && <p className="text-accent text-xs mb-2">Guardando el cambio...</p>}
          <div className={`rounded-2xl border border-white/[0.06] overflow-hidden ${editBusy ? "opacity-60 pointer-events-none" : ""}`}>
            <RoutineScreen
              key={`${day}-${weekOffset}`}
              routine={routine}
              userId={student.id}
              preview
              onEditNote={setEditing}
              onEditExercise={setEditingEx}
              onEditRoutineNote={(part, block) => setEditingNote({ part, block })}
              onEditTimer={(part, block) => setEditingTimer({ part, block })}
              onDeletePart={askDeletePart}
              onDeleteBlock={askDeleteBlock}
              onMoveBlock={moveBlock}
              onRemoveTimer={askRemoveTimer}
              onDeleteRoutineNote={askDeleteRoutineNote}
              onDeleteNote={askDeleteNote}
              onAddExercise={setAddingEx}
              onAddBlock={setAddingBlock}
              onDuplicateBlock={askDuplicateBlock}
              onEditBlockSets={(part, block, exercises) => setBlockSets({ part, block, exercises })}
              coachEdit={weekOffset === 0}
              liveTick={liveTick}
              onClose={onClose}
              onToggle={onToggle}
              onProgressChange={() => {}}
            />
          </div>
        </>
      )}

      {undoToast}
      {copyOpen && <CopyDaySheet dayLabel={day} targets={copyTargets} onCopy={doCopyDay} onClose={() => setCopyOpen(false)} />}
      {addingBlock && (
        <AddBlockSheet
          routineTitle={addingBlock.title}
          scoped={isScoped(addingBlock) && !addingBlock.isExtra}
          onSave={async (block, scope) => {
            const part = addingBlock;
            await runEdit(() => addBlock(editCtx(part, isScoped(part) && !part.isExtra ? scope : "all"), block), `Se agregó el bloque «${block.title}»`);
            return true;
          }}
          onClose={() => setAddingBlock(null)}
        />
      )}
      {addingEx && routine && (
        <ExerciseEditSheet
          addOnly
          student={student}
          routine={routine}
          exercise={addingEx}
          plan={dayInfo?.plan || null}
          planWeek={dayInfo?.planWeek || null}
          dayLabel={day}
          onClose={() => setAddingEx(null)}
          onSaved={async () => { await loadWeekSchedule(); }}
        />
      )}
      {ask && (
        <ScopeAskSheet
          title={ask.title}
          message={ask.message}
          scoped={ask.scoped}
          danger={ask.danger !== false}
          confirmLabel={ask.danger === false ? "Guardar" : "Sí, quitar"}
          onAnswer={(scope) => { const a = ask; setAsk(null); a.action(scope); }}
          onCancel={() => { const a = ask; setAsk(null); a.cancel?.(); }}
        />
      )}
      {editingTimer && (
        <TimerOverrideEditor
          blockTitle={editingTimer.block.title || blockTypeLabel(editingTimer.block.block_type)}
          routineTitle={editingTimer.part.title}
          initial={editingTimer.block.timer}
          base={editingTimer.block.timerBase}
          isCustom={editingTimer.block.timerCustom}
          onSave={saveTimer}
          onClose={() => setEditingTimer(null)}
        />
      )}
      {editingNote && (
        <RoutineNoteEditor
          title={editingNote.block === editingNote.part
            ? "Comentario del día"
            : editingNote.block.title || blockTypeLabel(editingNote.block.block_type)}
          routineTitle={editingNote.part.title}
          initial={editingNote.block === editingNote.part ? editingNote.part.dayNote || "" : (editingNote.block.notesCustom ? editingNote.block.notes : "")}
          base={editingNote.block === editingNote.part ? "" : editingNote.block.notesBase || ""}
          isCustom={editingNote.block === editingNote.part ? !!editingNote.part.dayNote : !!editingNote.block.notesCustom}
          isOff={editingNote.block !== editingNote.part && !!editingNote.block.notesOff}
          onSave={saveRoutineNote}
          onClose={() => setEditingNote(null)}
        />
      )}
      {editingEx && routine && (
        <ExerciseEditSheet
          student={student}
          routine={routine}
          exercise={editingEx}
          plan={week.days.find((d) => d.label === day)?.plan || null}
          planWeek={week.days.find((d) => d.label === day)?.planWeek || null}
          dayLabel={day}
          onClose={() => setEditingEx(null)}
          onSaved={async () => { await loadWeekSchedule(); }}
        />
      )}
      {blockSets && (
        <BlockSetsSheet
          student={student}
          part={blockSets.part}
          block={blockSets.block}
          exercises={blockSets.exercises}
          plan={dayInfo?.plan || null}
          planWeek={dayInfo?.planWeek || null}
          dayLabel={day}
          onClose={() => setBlockSets(null)}
          onSaved={async () => { await loadWeekSchedule(); }}
        />
      )}
      {editing && (
        <ExerciseNoteEditor
          exerciseName={editing.name}
          routineTitle={(routine?.parts || []).find((p) => String(p.id) === String(editing.routineId))?.title || routine?.title}
          initial={editing.note || ""}
          onSave={saveNote}
          onClose={() => setEditing(null)}
        />
      )}
    </PanelLayout>
  );
}
