// Borrar y reordenar desde "Rutina como la ve el alumno": bloques, el reloj de un bloque y rutinas enteras
// del día (por ejemplo, un remate). La rutina de la biblioteca NUNCA cambia: se trabaja sobre una copia
// solo de este alumno, que se pone en ese día (y, con planeación, solo esta semana o desde esta semana).
import { supabase } from "@/lib/supabaseClient";
import { loadRoutineContent, writeRoutineContent } from "@/components/coach/routines/routineHelpers";
import { TIMER_OFF, saveStudentTimer } from "@/lib/routineTimers";
import { saveStudentNote } from "@/lib/routineNotes";
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

// Lo que el coach le puso SOLO a este alumno en los bloques de una rutina (relojes y comentarios).
// Se guarda antes de quitar un bloque para poder devolverlo con "Deshacer".
async function studentBlockRows(studentId, routineId) {
  const [t, n] = await Promise.all([
    supabase.from("routine_timers").select("block_index, timer").eq("user_id", studentId).eq("routine_id", routineId),
    supabase.from("student_routine_notes").select("block_index, note").eq("user_id", studentId).eq("routine_id", routineId),
  ]);
  return { timers: t.data || [], notes: n.data || [] };
}

// Vuelve a escribir la rutina como estaba. now = posición actual de cada bloque viejo (o undefined si no
// está), para que los relojes y comentarios del alumno vuelvan a su bloque.
async function restoreBlocks(routineId, content, now) {
  const blocks = content.blocks.map((b) => ({ ...b, origIndex: now(b.origIndex) }));
  const err = await writeRoutineContent(routineId, "bloques", [], blocks, { timer: content.timer });
  if (err) throw fail("No se pudo deshacer.", err);
}

// Quita un bloque (por su posición en la rutina). Devuelve { undo } para "Deshacer".
export async function deleteBlock(ctx, blockIndex) {
  const routineId = await editablePartRoutine(ctx);
  const content = await loadRoutineContent(routineId);
  if (content.mode !== "bloques") throw new Error("Esta rutina no tiene bloques.");
  const blocks = content.blocks.filter((b) => b.origIndex !== blockIndex);
  if (blocks.length === content.blocks.length) throw new Error("No se encontró el bloque. Recargue y vuelva a intentar.");
  const own = await studentBlockRows(ctx.studentId, routineId);
  const err = await writeRoutineContent(routineId, "bloques", [], blocks, { timer: content.timer });
  if (err) throw fail("No se pudo quitar el bloque.", err);
  const kept = blocks.map((b) => b.origIndex);
  return {
    undo: async () => {
      await restoreBlocks(routineId, content, (old) => (kept.indexOf(old) >= 0 ? kept.indexOf(old) : undefined));
      // Lo del alumno en el bloque quitado se había borrado con él: vuelve
      const t = own.timers.find((x) => x.block_index === blockIndex);
      const n = own.notes.find((x) => x.block_index === blockIndex);
      if (t) await saveStudentTimer(supabase, ctx.studentId, routineId, blockIndex, t.timer);
      if (n) await saveStudentNote(supabase, ctx.studentId, routineId, blockIndex, n.note);
    },
  };
}

// Cambia el orden de los bloques. order = posiciones originales en el orden nuevo. Devuelve { undo }.
export async function reorderBlocks(ctx, order) {
  const routineId = await editablePartRoutine(ctx);
  const content = await loadRoutineContent(routineId);
  if (content.mode !== "bloques") throw new Error("Esta rutina no tiene bloques.");
  const byIndex = new Map(content.blocks.map((b) => [b.origIndex, b]));
  const blocks = order.map((i) => byIndex.get(i)).filter(Boolean);
  if (blocks.length !== content.blocks.length) throw new Error("La rutina cambió mientras tanto. Recargue y vuelva a intentar.");
  const err = await writeRoutineContent(routineId, "bloques", [], blocks, { timer: content.timer });
  if (err) throw fail("No se pudo cambiar el orden de los bloques.", err);
  return { undo: () => restoreBlocks(routineId, content, (old) => order.indexOf(old)) };
}

// Quita el reloj de un bloque SOLO para este alumno: si era suyo, se borra; si viene de la rutina, se apaga
export async function removeTimer(studentId, part, block) {
  const { data: prev } = await supabase.from("routine_timers").select("timer")
    .eq("user_id", studentId).eq("routine_id", part.id).eq("block_index", block.blockIndex).maybeSingle();
  const off = !!block.timerBase;
  const err = await saveStudentTimer(supabase, studentId, part.id, block.blockIndex, off ? TIMER_OFF : null);
  if (err) throw fail("No se pudo quitar el reloj.", err);
  return {
    undo: async () => {
      const e = await saveStudentTimer(supabase, studentId, part.id, block.blockIndex, prev?.timer ?? null);
      if (e) throw fail("No se pudo deshacer.", e);
    },
  };
}

// Quita el comentario del día o de un bloque solo para este alumno (si venía de la rutina, se apaga)
export async function removeRoutineNote(studentId, part, blockIndex, value) {
  const { data: prev } = await supabase.from("student_routine_notes").select("note")
    .eq("user_id", studentId).eq("routine_id", part.id).eq("block_index", blockIndex).maybeSingle();
  const err = await saveStudentNote(supabase, studentId, part.id, blockIndex, value);
  if (err) throw fail("No se pudo quitar el comentario.", err);
  return {
    undo: async () => {
      const e = await saveStudentNote(supabase, studentId, part.id, blockIndex, prev?.note ?? "");
      if (e) throw fail("No se pudo deshacer.", e);
    },
  };
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
    let newIds = [];
    if (pieces.length) {
      const { data: ins, error: e1 } = await supabase.from("student_extras").insert(pieces.map((p) => ({ ...base, ...p }))).select("id");
      if (e1) throw fail("No se pudo quitar el extra de este día.", e1);
      newIds = (ins || []).map((x) => x.id);
    }
    const { error: e2 } = await supabase.from("student_extras").delete().eq("id", extra.id);
    if (e2) throw fail("No se pudo quitar el extra de este día.", e2);
    return {
      undo: async () => {
        const original = { ...extra };
        delete original.routines;
        const { error: e3 } = await supabase.from("student_extras").insert(original);
        if (e3) throw fail("No se pudo deshacer.", e3);
        if (newIds.length) await supabase.from("student_extras").delete().in("id", newIds);
      },
    };
  }
  // Se guardan las filas que se quitan para poder devolverlas con "Deshacer"
  const restoreRows = (table, rows) => async () => {
    if (!rows?.length) return;
    const { error } = await supabase.from(table).insert(rows.map((x) => { const c = { ...x }; delete c.routines; return c; }));
    if (error) throw fail("No se pudo deshacer.", error);
  };
  if (plan && planWeek) {
    const weeks = planTargetWeeks(planWeek, plan.weeks, scope);
    const match = (q) => q.eq("plan_id", plan.id).eq("day_label", dayLabel).eq("routine_id", part.id).in("week_index", weeks);
    const { data: rows } = await match(supabase.from("training_plan_days").select("*"));
    const { error } = await match(supabase.from("training_plan_days").delete());
    if (error) throw fail("No se pudo quitar la rutina de la planeación.", error);
    return { undo: restoreRows("training_plan_days", rows) };
  }
  const match = (q) => q.eq("user_id", studentId).eq("day_label", dayLabel).eq("routine_id", part.id);
  const { data: rows } = await match(supabase.from("routine_assignments").select("*"));
  const { error } = await match(supabase.from("routine_assignments").delete());
  if (error) throw fail("No se pudo quitar la rutina de este día.", error);
  return { undo: restoreRows("routine_assignments", rows) };
}

// Agrega un bloque al final de la rutina del día (solo para este alumno). Devuelve { undo }.
// block = { block_type, title, sets, exercises: [{ exerciseId, name, reps }] }
export async function addBlock(ctx, block) {
  const routineId = await editablePartRoutine(ctx);
  const content = await loadRoutineContent(routineId);
  if (content.mode !== "bloques") throw new Error("Esta rutina es de lista simple: agregue ejercicios con «+ Agregar ejercicio».");
  const nuevo = {
    block_type: block.block_type,
    title: (block.title || "").trim(),
    sets: block.sets ? String(block.sets) : "",
    notes: "",
    timer: null,
    exercises: (block.exercises || []).map((e) => ({ itemKey: null, exerciseId: e.exerciseId, name: e.name, reps: e.reps || "", targetWeight: "", restMinutes: "" })),
  };
  const err = await writeRoutineContent(routineId, "bloques", [], [...content.blocks, nuevo], { timer: content.timer });
  if (err) throw fail("No se pudo agregar el bloque.", err);
  return { undo: () => restoreBlocks(routineId, content, (old) => old) };
}

// Duplica un bloque justo debajo de él (con sus ejercicios, como ejercicios nuevos). Devuelve { undo }.
export async function duplicateBlock(ctx, blockIndex) {
  const routineId = await editablePartRoutine(ctx);
  const content = await loadRoutineContent(routineId);
  if (content.mode !== "bloques") throw new Error("Esta rutina no tiene bloques.");
  const at = content.blocks.findIndex((b) => b.origIndex === blockIndex);
  if (at < 0) throw new Error("No se encontró el bloque. Recargue y vuelva a intentar.");
  const src = content.blocks[at];
  const copia = { ...src, origIndex: undefined, title: `${src.title || ""} (copia)`.trim(), exercises: src.exercises.map((e) => ({ ...e, itemKey: null })) };
  const blocks = [...content.blocks.slice(0, at + 1), copia, ...content.blocks.slice(at + 1)];
  const err = await writeRoutineContent(routineId, "bloques", [], blocks, { timer: content.timer });
  if (err) throw fail("No se pudo duplicar el bloque.", err);
  return { undo: () => restoreBlocks(routineId, content, (old) => (old <= blockIndex ? old : old + 1)) };
}

// Copia las rutinas de un día (sin los extras) a otro día o a la misma fecha de la semana siguiente.
// from / to = { week (del plan, o null sin plan), day } · mode "replace" (deja el destino igual) | "add" (suma)
// Las rutinas se comparten: si después se cambia una de las dos desde esta vista, se hace otra copia.
export async function copyDay({ studentId, plan, from, to, mode }) {
  if (plan) {
    const { data: src, error } = await supabase.from("training_plan_days").select("*").eq("plan_id", plan.id).eq("week_index", from.week).eq("day_label", from.day).order("order_index");
    if (error) throw fail("No se pudo leer el día.", error);
    if (!src?.length) throw new Error("Este día no tiene rutinas del plan para copiar.");
    const match = (q) => q.eq("plan_id", plan.id).eq("week_index", to.week).eq("day_label", to.day);
    const { data: before } = await match(supabase.from("training_plan_days").select("*"));
    if (mode === "replace" && before?.length) {
      const { error: d } = await match(supabase.from("training_plan_days").delete());
      if (d) throw fail("No se pudo copiar el día.", d);
    }
    const start = mode === "add" ? (before || []).reduce((m, x) => Math.max(m, (x.order_index ?? 0) + 1), 0) : 0;
    const rows = src.map((x, i) => { const c = { ...x, week_index: to.week, day_label: to.day, order_index: start + i }; delete c.id; delete c.created_at; delete c.routines; return c; });
    const { data: ins, error: e } = await supabase.from("training_plan_days").insert(rows).select("id");
    if (e) throw fail("No se pudo copiar el día.", e);
    return {
      undo: async () => {
        if (ins?.length) await supabase.from("training_plan_days").delete().in("id", ins.map((x) => x.id));
        if (mode === "replace" && before?.length) {
          const { error: r } = await supabase.from("training_plan_days").insert(before.map((x) => { const c = { ...x }; delete c.routines; return c; }));
          if (r) throw fail("No se pudo deshacer.", r);
        }
      },
    };
  }
  const { data: src, error } = await supabase.from("routine_assignments").select("*").eq("user_id", studentId).eq("day_label", from.day).order("order_index");
  if (error) throw fail("No se pudo leer el día.", error);
  if (!src?.length) throw new Error("Este día no tiene rutinas para copiar.");
  const match = (q) => q.eq("user_id", studentId).eq("day_label", to.day);
  const { data: before } = await match(supabase.from("routine_assignments").select("*"));
  if (mode === "replace" && before?.length) {
    const { error: d } = await match(supabase.from("routine_assignments").delete());
    if (d) throw fail("No se pudo copiar el día.", d);
  }
  const start = mode === "add" ? (before || []).reduce((m, x) => Math.max(m, (x.order_index ?? 0) + 1), 0) : 0;
  const rows = src.map((x, i) => { const c = { ...x, day_label: to.day, order_index: start + i }; delete c.id; delete c.created_at; delete c.routines; return c; });
  const { data: ins, error: e } = await supabase.from("routine_assignments").insert(rows).select("id");
  if (e) throw fail("No se pudo copiar el día.", e);
  return {
    undo: async () => {
      if (ins?.length) await supabase.from("routine_assignments").delete().in("id", ins.map((x) => x.id));
      if (mode === "replace" && before?.length) {
        const { error: r } = await supabase.from("routine_assignments").insert(before.map((x) => { const c = { ...x }; delete c.routines; return c; }));
        if (r) throw fail("No se pudo deshacer.", r);
      }
    },
  };
}
