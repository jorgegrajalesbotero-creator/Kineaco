"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { matchesSearch } from "@/lib/search";
import { SearchInput } from "@/components/ui/Search";
import { DayRoutinesEditor } from "@/components/coach/programs/DayRoutinesEditor";
import { PanelLayout } from "./PanelLayout";
import { toNumber } from "@/lib/numbers";
import { currentOrNextPlan, planLastDay, planStart, planWeekOf } from "@/lib/trainingPlan";

// Rutinas asignadas por día + pesos personalizados del alumno
export function DaysPanel({ student, onClose, onChanged }) {
  const [routines, setRoutines] = useState([]);
  const [dayAssignments, setDayAssignments] = useState({});
  const [savingDay, setSavingDay] = useState("");
  const [studentExercises, setStudentExercises] = useState([]);
  const [customWeights, setCustomWeights] = useState({});
  const [savingWeightId, setSavingWeightId] = useState("");
  const [weightSearch, setWeightSearch] = useState("");
  const [activePlan, setActivePlan] = useState(null);

  async function load() {
    const [{ data: routinesData }, { data }, { data: customData }] = await Promise.all([
      supabase.from("routines").select("id, title, level, goal"),
      supabase.from("routine_assignments").select("day_label, routine_id, order_index").eq("user_id", student.id).order("order_index"),
      supabase.from("student_exercise_weights").select("exercise_id, target_weight_kg").eq("user_id", student.id),
      supabase.from("training_plans").select("start_date, weeks").eq("user_id", student.id).then((r) => {
        setActivePlan(currentOrNextPlan(r.data || []));
        return r;
      }),
    ]);
    setRoutines(routinesData || []);

    const map = {};
    (data || []).forEach((a) => { map[a.day_label] = [...(map[a.day_label] || []), a.routine_id]; });
    setDayAssignments(map);

    const customMap = {};
    (customData || []).forEach((c) => { customMap[c.exercise_id] = c.target_weight_kg; });
    setCustomWeights(customMap);

    const routineIds = [...new Set(Object.values(map).flat().filter(Boolean))];
    const exercisesList = [];
    if (routineIds.length > 0) {
      const { data: rex } = await supabase
        .from("routine_exercises")
        .select("exercise_id, target_weight_kg, block_id, routine_blocks(block_type), exercises(name)")
        .in("routine_id", routineIds);
      const seen = {};
      (rex || []).forEach((r) => {
        if (r.block_id && r.routine_blocks?.block_type !== "principal") return;
        if (seen[r.exercise_id]) return;
        seen[r.exercise_id] = true;
        exercisesList.push({ exercise_id: r.exercise_id, name: r.exercises?.name || "Ejercicio", baseWeight: r.target_weight_kg });
      });
    }
    setStudentExercises(exercisesList);
  }

  useEffect(() => { load(); }, [student.id]);

  const setDayRoutines = async (day, list) => {
    setSavingDay(day);
    setDayAssignments((m) => ({ ...m, [day]: list }));

    const { error: delError } = await supabase.from("routine_assignments").delete().eq("user_id", student.id).eq("day_label", day);
    let insError = null;
    if (!delError && list.length > 0) {
      const { error } = await supabase
        .from("routine_assignments")
        .insert(list.map((routineId, i) => ({ user_id: student.id, routine_id: routineId, day_label: day, order_index: i })));
      insError = error;
    }
    if (delError || insError) alert("No se pudo guardar el día.");

    setSavingDay("");
    onChanged?.();
  };

  const saveCustomWeight = async (exerciseId, value) => {
    setSavingWeightId(exerciseId);
    const weight = toNumber(value);
    const { error } =
      weight === null
        ? await supabase.from("student_exercise_weights").delete().eq("user_id", student.id).eq("exercise_id", exerciseId)
        : await supabase
          .from("student_exercise_weights")
          .upsert({ user_id: student.id, exercise_id: exerciseId, target_weight_kg: weight }, { onConflict: "user_id,exercise_id" });
    setSavingWeightId("");
    if (error) return alert("No se pudo guardar el peso personalizado: ");
    setCustomWeights((m) => ({ ...m, [exerciseId]: weight }));
  };

  return (
    <PanelLayout title="Rutinas por día" subtitle={student.name} onClose={onClose}>
      {activePlan && (
        <p className="text-xs bg-accent/10 border border-accent/20 text-soft rounded-lg px-3 py-2 mb-3">
          {planWeekOf(activePlan, new Date()) ? "Tiene un plan activo" : "Tiene un plan que empieza pronto"} ({planStart(activePlan).toLocaleDateString("es-CO", { day: "numeric", month: "short" })} – {planLastDay(activePlan).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}). Mientras dure el plan, el alumno ve las rutinas del plan en vez de estos días fijos.
        </p>
      )}
      <p className="text-muted text-xs mb-3">Puede poner varias rutinas el mismo día; el alumno las ve juntas, en este orden.</p>
      <DayRoutinesEditor days={dayAssignments} routines={routines} savingDay={savingDay} emptyLabel="Descanso" onChangeDay={setDayRoutines} />

      {studentExercises.length > 0 && (
        <div className="mt-6">
          <h3 className="text-ink text-sm font-medium mb-1">Pesos personalizados</h3>
          <p className="text-muted text-xs mb-3">Opcional: pisa el peso sugerido de la rutina solo para este alumno. Dejalo vacío para usar el peso general.</p>
          {studentExercises.length > 5 && (
            <SearchInput value={weightSearch} onChange={setWeightSearch} placeholder="Buscar ejercicio..." className="mb-2" />
          )}
          <div className="bg-card rounded-xl overflow-hidden">
            {studentExercises.filter((ex) => matchesSearch(weightSearch, ex.name)).map((ex) => (
              <div key={ex.exercise_id} className="flex items-center justify-between px-4 py-3 border-b border-field last:border-0">
                <div>
                  <p className="text-ink text-sm">{ex.name}</p>
                  <p className="text-muted text-[10px]">Peso general: {ex.baseWeight != null ? `${ex.baseWeight} kg` : "sin definir"}</p>
                </div>
                <input
                  type="text" inputMode="decimal"
                  placeholder={ex.baseWeight != null ? `${ex.baseWeight}` : "kg"}
                  defaultValue={customWeights[ex.exercise_id] ?? ""}
                  onBlur={(e) => saveCustomWeight(ex.exercise_id, e.target.value)}
                  disabled={savingWeightId === ex.exercise_id}
                  className="w-24 bg-field text-ink text-sm rounded-lg px-2 py-1.5 outline-none text-right"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </PanelLayout>
  );
}
