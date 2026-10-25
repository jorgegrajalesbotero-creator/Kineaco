"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { matchesSearch } from "@/lib/search";
import {
  atrSplit, expandPlanWeeks, formatShortDate, phaseDisplayName, planWeekForDate, sortPhases, weekStartDate,
} from "@/lib/planning";
import { SearchInput } from "@/components/ui/Search";
import { PanelLayout } from "./PanelLayout";
import { cleanDecimal } from "@/lib/numbers";

const EMPTY_ITEM = { value_type: "kg", value: "", reps: "" };

// Progresión de cargas (peso y reps por semana) conectada con la planeación por fases
export function ProgressionPanel({ student, onClose }) {
  const [progression, setProgression] = useState(null);
  const [progressionPlan, setProgressionPlan] = useState(null);
  const [progressionExercises, setProgressionExercises] = useState([]);
  const [progressionItems, setProgressionItems] = useState({});
  const [editingWeek, setEditingWeek] = useState(1);
  const [newAccWeeks, setNewAccWeeks] = useState("4");
  const [newTransWeeks, setNewTransWeeks] = useState("3");
  const [newRealWeeks, setNewRealWeeks] = useState("2");
  const [savingProgression, setSavingProgression] = useState(false);
  const [progressionSearch, setProgressionSearch] = useState("");

  useEffect(() => {
    async function load() {
      const [{ data: prog }, { data: planRow }, { data: assignments }, { data: trainingPlans }] = await Promise.all([
        supabase.from("load_progressions").select("*").eq("user_id", student.id).maybeSingle(),
        supabase
          .from("student_plans")
          .select("start_date, name, student_plan_phases(phase_type, name, weeks, order_index)")
          .eq("user_id", student.id)
          .maybeSingle(),
        supabase.from("routine_assignments").select("routine_id").eq("user_id", student.id),
        supabase.from("training_plans").select("training_plan_days(routine_id)").eq("user_id", student.id),
      ]);

      setProgression(prog || null);
      setEditingWeek(prog ? prog.current_week : 1);

      const planPhases = sortPhases(planRow?.student_plan_phases);
      setProgressionPlan(
        planRow && planPhases.length > 0
          ? { start_date: planRow.start_date, name: planRow.name, phases: planPhases, weeks: expandPlanWeeks(planPhases) }
          : null
      );

      // Ejercicios de trabajo principal de sus rutinas asignadas
      const planRoutineIds = (trainingPlans || []).flatMap((tp) => (tp.training_plan_days || []).map((d) => d.routine_id));
      const routineIds = [...new Set([...(assignments || []).map((a) => a.routine_id), ...planRoutineIds].filter(Boolean))];
      const exercisesList = [];
      if (routineIds.length > 0) {
        const { data: rex } = await supabase
          .from("routine_exercises")
          .select("exercise_id, block_id, reps, routine_blocks(block_type), exercises(name)")
          .in("routine_id", routineIds);
        const seen = {};
        (rex || []).forEach((r) => {
          if (r.block_id && r.routine_blocks?.block_type !== "principal") return;
          if (seen[r.exercise_id]) return;
          seen[r.exercise_id] = true;
          exercisesList.push({ exercise_id: r.exercise_id, name: r.exercises?.name || "Ejercicio", reps: r.reps || "" });
        });
      }
      setProgressionExercises(exercisesList);

      const map = {};
      if (prog) {
        const { data: items } = await supabase.from("load_progression_items").select("*").eq("progression_id", prog.id);
        (items || []).forEach((it) => {
          map[`${it.week_number}_${it.exercise_id}`] = { value_type: it.value_type || "kg", value: it.value ?? "", reps: it.reps ?? "" };
        });
      }
      setProgressionItems(map);
    }
    load();
  }, [student.id]);

  const createProgression = async () => {
    setSavingProgression(true);
    const { data: { user } } = await supabase.auth.getUser();
    const weeks = progressionPlan
      ? atrSplit(progressionPlan.phases)
      : {
        accumulation_weeks: Number(newAccWeeks) || 0,
        transformation_weeks: Number(newTransWeeks) || 0,
        realization_weeks: Number(newRealWeeks) || 0,
      };
    const { data, error } = await supabase
      .from("load_progressions")
      .insert({ user_id: student.id, ...weeks, current_week: 1, created_by: user?.id })
      .select()
      .single();
    setSavingProgression(false);
    if (error) return alert("Error al crear la progresión: " + error.message);
    setProgression(data);
    setEditingWeek(1);
  };

  const totalWeeks = (prog) => {
    if (!prog) return 0;
    const base = progressionPlan
      ? progressionPlan.weeks.length
      : prog.accumulation_weeks + prog.transformation_weeks + prog.realization_weeks;
    return Math.max(base, prog.current_week || 0);
  };

  const phaseForWeek = (week, prog) => {
    if (!prog) return "";
    if (progressionPlan) {
      const info = progressionPlan.weeks[week - 1];
      if (!info) return "Fuera del plan";
      return `${phaseDisplayName(info.phase)} (${formatShortDate(weekStartDate(progressionPlan.start_date, week))})`;
    }
    if (week <= prog.accumulation_weeks) return "Acumulación";
    if (week <= prog.accumulation_weeks + prog.transformation_weeks) return "Transformación";
    return "Realización";
  };

  const saveCurrentWeek = async (week) => {
    setSavingProgression(true);
    const { error } = await supabase
      .from("load_progressions")
      .update({ current_week: week, updated_at: new Date().toISOString() })
      .eq("id", progression.id);
    setSavingProgression(false);
    if (error) return alert("No se pudo cambiar la semana: " + error.message);
    setProgression((p) => ({ ...p, current_week: week }));
  };

  const setItemValue = (exerciseId, field, value) => {
    setProgressionItems((m) => {
      const key = `${editingWeek}_${exerciseId}`;
      return { ...m, [key]: { ...(m[key] || EMPTY_ITEM), [field]: value } };
    });
  };

  const saveWeek = async () => {
    if (!progression) return;
    setSavingProgression(true);
    await supabase.from("load_progression_items").delete().eq("progression_id", progression.id).eq("week_number", editingWeek);

    const rows = progressionExercises
      .map((ex) => {
        const it = progressionItems[`${editingWeek}_${ex.exercise_id}`];
        if (!it) return null;
        const hasValue = !(it.value === "" || it.value == null);
        const reps = String(it.reps ?? "").trim();
        if (!hasValue && !reps) return null;
        return {
          progression_id: progression.id,
          week_number: editingWeek,
          exercise_id: ex.exercise_id,
          value_type: it.value_type || "kg",
          value: hasValue ? Number(it.value) : null,
          reps: reps || null,
        };
      })
      .filter(Boolean);

    if (rows.length > 0) {
      const { error } = await supabase.from("load_progression_items").insert(rows);
      if (error) alert("Error al guardar la semana: " + error.message);
    }
    setSavingProgression(false);
  };

  const deleteProgression = async () => {
    if (!progression) return;
    if (!confirm("¿Seguro que querés eliminar toda la progresión de este alumno?")) return;
    setSavingProgression(true);
    const { error } = await supabase.from("load_progressions").delete().eq("id", progression.id);
    setSavingProgression(false);
    if (error) return alert("No se pudo eliminar la progresión: " + error.message);
    onClose();
  };

  return (
    <PanelLayout title="Progresión ATR" subtitle={student.name} onClose={onClose} width="max-w-2xl">
      {!progression ? (
        <div className="bg-card rounded-xl p-5">
          <p className="text-ink text-sm mb-1">Este alumno todavía no tiene una progresión</p>
          {progressionPlan ? (
            <div className="mb-4">
              <p className="text-muted text-xs mb-3">Las semanas salen de su planeación ({progressionPlan.weeks.length} semanas):</p>
              <div className="space-y-1">
                {progressionPlan.phases.map((p, i) => (
                  <p key={i} className="text-soft text-xs">· {phaseDisplayName(p)}: {p.weeks} semana{Number(p.weeks) === 1 ? "" : "s"}</p>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="text-muted text-xs mb-4">Definí cuántas semanas dura cada fase para empezar. (Si le armás un plan en "Planeación", las semanas salen de ahí.)</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <p className="text-muted text-[10px] mb-1">Acumulación (semanas)</p>
                  <input type="number" value={newAccWeeks} onChange={(e) => setNewAccWeeks(e.target.value)} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                </div>
                <div>
                  <p className="text-muted text-[10px] mb-1">Transformación (semanas)</p>
                  <input type="number" value={newTransWeeks} onChange={(e) => setNewTransWeeks(e.target.value)} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                </div>
                <div>
                  <p className="text-muted text-[10px] mb-1">Realización (semanas)</p>
                  <input type="number" value={newRealWeeks} onChange={(e) => setNewRealWeeks(e.target.value)} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                </div>
              </div>
            </>
          )}
          <button onClick={createProgression} disabled={savingProgression} className="bg-accent text-app font-medium text-sm rounded-lg px-4 py-2.5 disabled:opacity-60">
            {savingProgression ? "Creando..." : "Crear progresión"}
          </button>
        </div>
      ) : (
        <>
          <div className="bg-card rounded-xl p-4 mb-4">
            <p className="text-muted text-xs mb-1">Semana actual del alumno</p>
            <select
              value={progression.current_week}
              onChange={(e) => saveCurrentWeek(Number(e.target.value))}
              className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none"
            >
              {Array.from({ length: totalWeeks(progression) }).map((_, i) => {
                const w = i + 1;
                return <option key={w} value={w}>Semana {w} · {phaseForWeek(w, progression)}</option>;
              })}
            </select>
            <p className="text-muted text-[10px] mt-2">Esto es lo que ve el alumno en su rutina. Cambialo cuando quieras que avance (o retroceda) de semana.</p>
            {progressionPlan && (() => {
              const w = planWeekForDate(progressionPlan.start_date, new Date());
              const info = progressionPlan.weeks[w - 1];
              if (!info) {
                return <p className="text-soft text-[11px] mt-2">{w < 1 ? `Según la planeación, el plan empieza el ${formatShortDate(weekStartDate(progressionPlan.start_date, 1))}.` : "Según la planeación, el plan ya terminó."}</p>;
              }
              if (w === progression.current_week) {
                return <p className="text-accent text-[11px] mt-2">✓ Va al día con la planeación (semana {w} · {phaseDisplayName(info.phase)}).</p>;
              }
              return (
                <div className="mt-2 flex items-center justify-between gap-2 bg-field rounded-lg px-3 py-2">
                  <p className="text-warning text-[11px]">Según la planeación, esta semana debería ir en la semana {w} · {phaseDisplayName(info.phase)}.</p>
                  <button onClick={() => saveCurrentWeek(w)} disabled={savingProgression} className="text-accent text-[11px] font-medium shrink-0 disabled:opacity-60">Pasar a la {w}</button>
                </div>
              );
            })()}
          </div>

          <div className="bg-card rounded-xl p-4 mb-4">
            <p className="text-muted text-xs mb-2">Editando semana</p>
            <select
              value={editingWeek}
              onChange={(e) => setEditingWeek(Number(e.target.value))}
              className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none mb-4"
            >
              {Array.from({ length: totalWeeks(progression) }).map((_, i) => {
                const w = i + 1;
                return <option key={w} value={w}>Semana {w} · {phaseForWeek(w, progression)}</option>;
              })}
            </select>

            {progressionExercises.length === 0 ? (
              <p className="text-muted text-xs italic">Este alumno todavía no tiene ejercicios en sus rutinas asignadas.</p>
            ) : (
              <div className="space-y-3 sm:space-y-2">
                {progressionExercises.length > 5 && (
                  <SearchInput value={progressionSearch} onChange={setProgressionSearch} placeholder="Buscar ejercicio..." />
                )}
                <div className="hidden sm:flex items-center gap-2 text-muted text-[10px]">
                  <span className="flex-1">Ejercicio</span>
                  <span className="w-[150px] text-center">Peso</span>
                  <span className="w-24 text-center">Reps</span>
                </div>
                {progressionExercises.filter((ex) => matchesSearch(progressionSearch, ex.name)).map((ex) => {
                  const item = progressionItems[`${editingWeek}_${ex.exercise_id}`] || EMPTY_ITEM;
                  return (
                    <div key={ex.exercise_id} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <span className="text-ink text-sm w-full sm:w-auto sm:flex-1">{ex.name}</span>
                      <select
                        value={item.value_type}
                        onChange={(e) => setItemValue(ex.exercise_id, "value_type", e.target.value)}
                        className="bg-field text-soft text-xs rounded-lg px-2 py-2 outline-none"
                      >
                        <option value="kg">kg</option>
                        <option value="percent">%</option>
                      </select>
                      <input
                        type="text" inputMode="decimal"
                        value={item.value}
                        onChange={(e) => setItemValue(ex.exercise_id, "value", cleanDecimal(e.target.value))}
                        placeholder="peso"
                        className="flex-1 sm:flex-none sm:w-24 min-w-0 bg-field text-ink text-sm rounded-lg px-2 py-2 outline-none text-right"
                      />
                      <input
                        type="text"
                        value={item.reps ?? ""}
                        onChange={(e) => setItemValue(ex.exercise_id, "reps", e.target.value)}
                        placeholder={ex.reps ? `${ex.reps} reps` : "reps"}
                        className="flex-1 sm:flex-none sm:w-24 min-w-0 bg-field text-ink text-sm rounded-lg px-2 py-2 outline-none text-right"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={saveWeek} disabled={savingProgression} className="mt-4 bg-accent text-app font-medium text-sm rounded-lg px-4 py-2.5 disabled:opacity-60">
              {savingProgression ? "Guardando..." : `Guardar semana ${editingWeek}`}
            </button>
          </div>

          <button onClick={deleteProgression} disabled={savingProgression} className="text-danger text-sm flex items-center gap-1.5 disabled:opacity-60">
            <Trash2 size={14} /> Eliminar progresión completa
          </button>
        </>
      )}
    </PanelLayout>
  );
}
