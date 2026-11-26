// Borrar y reordenar desde "Rutina como la ve el alumno": bloques, el reloj de un bloque y rutinas enteras
// del día (por ejemplo, un remate). La rutina de la biblioteca NUNCA cambia: se trabaja sobre una copia
// solo de este alumno, que se pone en ese día (y, con planeación, solo esta semana o desde esta semana).
import { supabase } from "@/lib/supabaseClient";
import { loadRoutineContent, writeRoutineContent } from "@/components/coach/routines/routineHelpers";
import { TIMER_OFF, saveStudentTimer } from "@/lib/routineTimers";
import { canEditInPlace, planTargetWeeks, splitExtra } from "@/lib/previewEdits";
import { copyRoutineForStudent, ensurePrivateRoutine } from "./exerciseEdits";

const fail = (msg, error) => new Error(error?.message ? `${msg}\n\nDetalle: ${error.message}` : msg);
const isMine = (part, studentId) => !!part.student_id && String(part.student_id) === String(studentId);

// Los cambios de ejercicios que el plan ya tenía para la rutina original pasan a la copia
async function copyPlanChanges(planId, fromRoutineId, toRoutineId, keyMap) {
  const { data, error } = await supabase.from("training_plan_exercise_changes").select("*").eq("plan_id", planId).eq("routine_id", fromRoutineId);
  if (error) throw fail("No se pudieron leer los cambios de la planeación.", error);
  if (!data?.length) return;
  const map = (k) => (k && keyMap[k] ? keyMap[k] : k);
  const rows = data.map((c) => {
    const copy = { ...c, routine_id: toRoutineId, item_key: map(c.item_key), after_item_key: map(c.after_item_key) };
    delete copy.id;
    delete copy.created_at;
    delete copy.exercises;
    return copy;
  });
  const { error: e } = await supabase.from("training_plan_exercise_changes").insert(rows);
  if (e) throw fail("No se pudieron pasar los cambios de la planeación a la copia.", e);
}

// ctx = { studentId, part, dayLabel, plan, planWeek, scope, schedule }
// Devuelve el id de la rutina de este alumno que se puede editar sin afectar a nadie más.
export async function editablePartRoutine({ studentId, part, dayLabel, plan, planWeek, scope, schedule }) {
  if (!plan || !planWeek || part.isExtra) {
    if (isMine(part, studentId)) return part.id;
    return (await ensurePrivateRoutine({ studentId, part, dayLabel })).routineId;
  }
  const weeks = planTargetWeeks(planWeek, plan.weeks, scope);
  if (isMine(part, studentId) && canEditInPlace(part.id, schedule, plan.id, dayLabel, weeks)) return part.id;
  const { routineId, keyMap } = await copyRoutineForStudent({ studentId, part });
  const { error } = await supabase.from("training_plan_days").update({ routine_id: routineId })
    .eq("plan_id", plan.id).eq("day_label", dayLabel).eq("routine_id", part.id).in("week_index", weeks);
  if (error) {
    await supabase.from("routines").delete().eq("id", routineId);
    throw fail("No se pudo poner la copia en la planeación.", error);
  }
  await copyPlanChanges(plan.id, part.id, routineId, keyMap || {});
  return routineId;
}

// Quita un bloque (por su posición en la rutina)
export async function deleteBlock(ctx, blockIndex) {
  const routineId = await editablePartRoutine(ctx);
  const content = await loadRoutineContent(routineId);
  if (content.mode !== "bloques") throw new Error("Esta rutina no tiene bloques.");
  const blocks = content.blocks.filter((b) => b.origIndex !== blockIndex);
  if (blocks.length === content.blocks.length) throw new Error("No se encontró el bloque. Recargue y vuelva a intentar.");
  const err = await writeRoutineContent(routineId, "bloques", [], blocks, { timer: content.timer });
  if (err) throw fail("No se pudo quitar el bloque.", err);
}

// Cambia el orden de los bloques. order = posiciones originales en el orden nuevo
export async function reorderBlocks(ctx, order) {
  const routineId = await editablePartRoutine(ctx);
  const content = await loadRoutineContent(routineId);
  if (content.mode !== "bloques") throw new Error("Esta rutina no tiene bloques.");
  const byIndex = new Map(content.blocks.map((b) => [b.origIndex, b]));
  const blocks = order.map((i) => byIndex.get(i)).filter(Boolean);
  if (blocks.length !== content.blocks.length) throw new Error("La rutina cambió mientras tanto. Recargue y vuelva a intentar.");
  const err = await writeRoutineContent(routineId, "bloques", [], blocks, { timer: content.timer });
  if (err) throw fail("No se pudo cambiar el orden de los bloques.", err);
}

// Quita el reloj de un bloque SOLO para este alumno: si era suyo, se borra; si viene de la rutina, se apaga
export async function removeTimer(studentId, part, block) {
  const off = !!block.timerBase;
  const err = await saveStudentTimer(supabase, studentId, part.id, block.blockIndex, off ? TIMER_OFF : null);
  if (err) throw fail("No se pudo quitar el reloj.", err);
}

// Quita una rutina entera del día (por ejemplo, «Remate abdomen»)
//  - Extra: se quita ese día de la semana del extra (solo esta semana o desde esta semana)
//  - Con planeación: se quita de ese día en esa semana del plan (o desde esa semana)
//  - Semana base: se quita de ese día
export async function deletePart({ studentId, part, dayLabel, plan, planWeek, scope, mondayISO }) {
  if (part.isExtra && part.extraId) {
    const { data: extra, error } = await supabase.from("student_extras").select("*").eq("id", part.extraId).maybeSingle();
    if (error || !extra) throw fail("No se encontró el extra. Recargue y vuelva a intentar.", error);
    const pieces = splitExtra(extra, mondayISO, dayLabel, scope);
    const base = { ...extra };
    delete base.id;
    delete base.created_at;
    delete base.routines;
    if (pieces.length) {
      const { error: e1 } = await supabase.from("student_extras").insert(pieces.map((p) => ({ ...base, ...p })));
      if (e1) throw fail("No se pudo quitar el extra de este día.", e1);
    }
    const { error: e2 } = await supabase.from("student_extras").delete().eq("id", extra.id);
    if (e2) throw fail("No se pudo quitar el extra de este día.", e2);
    return;
  }
  if (plan && planWeek) {
    const weeks = planTargetWeeks(planWeek, plan.weeks, scope);
    const { error } = await supabase.from("training_plan_days").delete()
      .eq("plan_id", plan.id).eq("day_label", dayLabel).eq("routine_id", part.id).in("week_index", weeks);
    if (error) throw fail("No se pudo quitar la rutina de la planeación.", error);
    return;
  }
  const { error } = await supabase.from("routine_assignments").delete().eq("user_id", studentId).eq("day_label", dayLabel).eq("routine_id", part.id);
  if (error) throw fail("No se pudo quitar la rutina de este día.", error);
}
