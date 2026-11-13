"use client";

import { useEffect, useState } from "react";
import { Activity, Calendar, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { WEEK_DAYS, todayDayLabel } from "@/lib/dates";
import { addDays, loadSchedule, mondayOf, routinesForDate } from "@/lib/trainingPlan";
import { buildDay } from "@/lib/studentRoutine";
import { saveExerciseNote } from "@/lib/exerciseNotes";
import { RoutineScreen } from "@/components/student/RoutineScreen";
import { Skeleton } from "@/components/ui/Skeleton";
import { PanelLayout } from "./PanelLayout";
import { ExerciseNoteEditor } from "./ExerciseNoteEditor";

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

  async function loadWeekSchedule() {
    setSchedule(await loadSchedule(supabase, student.id, "*"));
  }
  useEffect(() => { loadWeekSchedule(); }, [student.id]);

  async function loadRoutine(sched, d, offset) {
    setLoading(true);
    try {
      setRoutine(await buildDay(supabase, student.id, d, { weekOffset: offset, schedule: sched }));
    } catch {
      setRoutine(null);
    }
    setLoading(false);
  }
  useEffect(() => { if (schedule) loadRoutine(schedule, day, weekOffset); }, [schedule, day, weekOffset]);

  const monday = addDays(mondayOf(new Date()), weekOffset * 7);
  const weekDays = schedule
    ? WEEK_DAYS.map((label, i) => {
        const date = addDays(monday, i);
        const info = routinesForDate(schedule.plans, schedule.fixed, date);
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

  return (
    <PanelLayout title="Rutina como la ve el alumno" subtitle={student.isSelf ? "Mi entrenamiento" : student.name} onClose={onClose} width="max-w-2xl">
      <p className="text-muted text-xs mb-4 flex items-start gap-2">
        <Eye size={14} className="shrink-0 mt-0.5" />
        <span>Así le aparece al alumno (con su plan, cargas y cambios de esa semana). Tocá «Observación» en cualquier ejercicio: es solo para este alumno, vale todas las semanas y no cambia la rutina ni la planeación.</span>
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => onOpenPanel?.("plan")} className="bg-card text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink">
          <Calendar size={13} /> Editar en Planeación
        </button>
        <button onClick={() => onOpenPanel?.("days")} className="bg-card text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink">
          <Activity size={13} /> Semana base (días fijos)
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
          {noteCount > 0 && <p className="text-accent text-xs mb-2">{noteCount} ejercicio{noteCount > 1 ? "s" : ""} con observación este día</p>}
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
            <RoutineScreen
              key={`${day}-${weekOffset}`}
              routine={routine}
              userId={student.id}
              preview
              onEditNote={setEditing}
              onClose={onClose}
              onToggle={() => {}}
              onProgressChange={() => {}}
            />
          </div>
        </>
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
