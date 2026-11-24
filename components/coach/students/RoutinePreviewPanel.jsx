"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Calendar, ChevronLeft, ChevronRight, Eye, Layers, Lock, LockOpen, PlusCircle } from "lucide-react";
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
import { BulkSetsSheet } from "./BulkSetsSheet";
import { CheckoutSummary } from "./CheckoutSummary";
import { loadCheckout } from "@/lib/checkout";
import { TimerOverrideEditor } from "./TimerOverrideEditor";
import { saveStudentTimer } from "@/lib/routineTimers";
import { RoutineNoteEditor } from "./RoutineNoteEditor";
import { ROUTINE_NOTE_INDEX, saveStudentNote } from "@/lib/routineNotes";
import { blockTypeLabel } from "@/lib/blocks";

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
  const [bulkOpen, setBulkOpen] = useState(false); // series de todos los ejercicios a la vez
  const [editingTimer, setEditingTimer] = useState(null); // { part, block } reloj solo para este alumno
  const [editingNote, setEditingNote] = useState(null); // { part, block } comentario solo para este alumno (block === part: el del día)
  const [session, setSession] = useState(null); // ¿el alumno ya finalizó este día?
  const [checkout, setCheckout] = useState(null); // check-out del alumno ese día (molestias, esfuerzo, comentario)
  const [sessionBusy, setSessionBusy] = useState(false);
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
  const noteCount = routine ? routine.exercises.filter((e) => e.note).length : 0;

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

  return (
    <PanelLayout title="Rutina como la ve el alumno" subtitle={student.isSelf ? "Mi entrenamiento" : student.name} onClose={onClose} width="max-w-2xl">
      <p className="text-muted text-xs mb-4 flex items-start gap-2">
        <Eye size={14} className="shrink-0 mt-0.5" />
        <span>Así le aparece al alumno (con su plan, cargas y cambios de esa semana). Desde aquí podés editar todo: «Editar» cambia peso, series, reps o el ejercicio (solo esta semana o desde esta semana); «Observación», los comentarios y el reloj son solo para este alumno.</span>
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => onOpenPanel?.("plan")} className="bg-card text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink">
          <Calendar size={13} /> Editar en Planeación
        </button>
        <button onClick={() => onOpenPanel?.("days")} className="bg-card text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink">
          <Activity size={13} /> Semana base (días fijos)
        </button>
        <button onClick={() => onOpenPanel?.("extras")} className="bg-card text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink">
          <PlusCircle size={13} /> Extras (remates, intermitentes, entrenos)
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
          {weekOffset === 0 && <p className="text-muted text-[11px] mb-2">Las series y ejercicios los marca solo el alumno; vos ves cada uno apenas lo marca. Para corregir un peso o unas reps de una serie ya hecha: abrí el ejercicio → «Corregir peso y reps de cada serie».</p>}
          {checkout && <div className="mb-3"><CheckoutSummary checkout={checkout} title="Check-out de este día" /></div>}
          {weekOffset === 0 && (routine?.exercises || []).length > 1 && (
            <button onClick={() => setBulkOpen(true)} className="w-full bg-card text-ink text-sm rounded-xl px-4 py-3 mb-3 flex items-center gap-2 hover:bg-field">
              <Layers size={15} className="text-accent" />
              <span className="flex-1 text-left">Cambiar series de todos los ejercicios</span>
              <span className="text-muted text-xs">Para uno solo: «Editar»</span>
            </button>
          )}
          {noteCount > 0 && <p className="text-accent text-xs mb-2">{noteCount} ejercicio{noteCount > 1 ? "s" : ""} con observación este día</p>}
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
            <RoutineScreen
              key={`${day}-${weekOffset}`}
              routine={routine}
              userId={student.id}
              preview
              onEditNote={setEditing}
              onEditExercise={setEditingEx}
              onEditRoutineNote={(part, block) => setEditingNote({ part, block })}
              onEditTimer={(part, block) => setEditingTimer({ part, block })}
              coachEdit={weekOffset === 0}
              liveTick={liveTick}
              onClose={onClose}
              onToggle={onToggle}
              onProgressChange={() => {}}
            />
          </div>
        </>
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
      {bulkOpen && routine && (
        <BulkSetsSheet
          student={student}
          routine={routine}
          plan={week.days.find((d) => d.label === day)?.plan || null}
          planWeek={week.days.find((d) => d.label === day)?.planWeek || null}
          dayLabel={day}
          onClose={() => setBulkOpen(false)}
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
