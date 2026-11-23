// Cambios que el coach hace a UN ejercicio desde "Ver su rutina (como la ve el alumno)".
// - Con planeación: peso / series / reps y sustituir / quitar / agregar van a la planeación del alumno,
//   "solo esta semana" o "desde esta semana en adelante". La rutina original no cambia.
// - Sin planeación (semana base) o en un extra: se edita una copia de la rutina SOLO para este alumno
//   (la de la biblioteca no cambia). El peso del trabajo principal va a sus pesos personalizados.
import { supabase } from "@/lib/supabaseClient";
import { baseFor, rmOf } from "@/lib/loadCalc";
import { loadRoutineContent, writeRoutineContent } from "@/components/coach/routines/routineHelpers";

const newKey = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const fail = (msg, error) => new Error(error?.message ? `${msg}\n\nDetalle: ${error.message}` : msg);

// ---------- Con planeación ----------

// Peso, series y reps de un ejercicio. changed = { kg, sets, reps } (qué escribió el coach).
// scope "week" = solo esa semana (casilla a mano) · "from" = desde esa semana: el peso cambia la base
// (el cálculo sigue solo con la nueva base); si no hay base que se pueda ajustar, se escriben las casillas.
export async function savePlanValues({ plan, week, exerciseId, scope, kg, sets, reps, currentKg, changed }) {
  const planId = plan.id;
  const last = Math.max(week, Number(plan.weeks) || week);
  const targetWeeks = scope === "from" ? Array.from({ length: last - week + 1 }, (_, i) => week + i) : [week];

  const [{ data: cellRows, error: cErr }, { data: loads, error: lErr }] = await Promise.all([
    supabase.from("training_plan_load_cells").select("*").eq("plan_id", planId).eq("exercise_id", exerciseId),
    supabase.from("training_plan_loads").select("*").eq("plan_id", planId).eq("exercise_id", exerciseId),
  ]);
  if (cErr || lErr) throw fail("No se pudo leer la planeación.", cErr || lErr);

  // Peso desde esta semana: nueva base desde esa semana
  let kgByBase = false;
  if (changed.kg && scope === "from" && kg != null) {
    const base = baseFor(loads, exerciseId, week);
    let row = null;
    if (base && (base.base_type === "rm" || base.base_type === "work") && Number(currentKg) > 0) {
      const rm = rmOf(base) * (kg / Number(currentKg));
      row = { base_type: "rm", weight_kg: Math.round(rm * 10) / 10, reps: null, rounding: base.rounding || 2.5 };
    } else if (base && base.base_type === "double") {
      row = { base_type: "double", weight_kg: kg, reps: null, rep_min: base.rep_min, rep_max: base.rep_max, increment: base.increment, rounding: base.rounding || 2.5 };
    }
    if (row) {
      const { error: dErr } = await supabase.from("training_plan_loads").delete().eq("plan_id", planId).eq("exercise_id", exerciseId).eq("from_week", week);
      if (dErr) throw fail("No se pudo cambiar el peso.", dErr);
      const { error } = await supabase.from("training_plan_loads").insert({ plan_id: planId, exercise_id: exerciseId, from_week: week, ...row });
      if (error) throw fail("No se pudo cambiar el peso.", error);
      kgByBase = true;
    }
  }

  // Casillas a mano de las semanas que tocan (se conservan los valores que no se cambiaron)
  const byWeek = new Map((cellRows || []).map((c) => [Number(c.week_index), c]));
  const touched = new Set(targetWeeks);
  // Si el peso pasó a una base nueva, los pesos escritos a mano de esas semanas ya no mandan
  if (kgByBase) (cellRows || []).forEach((c) => { if (Number(c.week_index) >= week) touched.add(Number(c.week_index)); });
  const rows = [];
  touched.forEach((w) => {
    const old = byWeek.get(w) || {};
    const inTarget = targetWeeks.includes(w);
    const r = {
      plan_id: planId, exercise_id: exerciseId, week_index: w, value_type: "kg",
      value: kgByBase ? null : inTarget && changed.kg ? kg : old.value ?? null,
      reps: inTarget && changed.reps ? reps || null : old.reps ?? null,
      sets: inTarget && changed.sets ? sets || null : old.sets ?? null,
    };
    if (r.value != null || r.reps || r.sets != null) rows.push(r);
  });
  const weeksList = [...touched];
  if (weeksList.length) {
    const { error: dErr } = await supabase.from("training_plan_load_cells").delete().eq("plan_id", planId).eq("exercise_id", exerciseId).in("week_index", weeksList);
    if (dErr) throw fail("No se pudieron guardar el peso, las series o las reps.", dErr);
  }
  if (rows.length) {
    const { error } = await supabase.from("training_plan_load_cells").insert(rows);
    if (error) throw fail("No se pudieron guardar el peso, las series o las reps.", error);
  }
}

// Sustituir / quitar / agregar dentro de la planeación del alumno.
// "Solo esta semana" se arma con un segundo cambio la semana siguiente que lo deshace.
export async function savePlanChange({ plan, routineId, week, scope, action, itemKey, currentExerciseId, newExerciseId, sets = null, reps = null }) {
  const planId = plan.id;
  const total = Number(plan.weeks) || week;
  const nextWeek = scope === "week" && week < total ? week + 1 : null;
  const { data: prev } = await supabase.from("training_plan_exercise_changes").select("order_index").eq("plan_id", planId).order("order_index", { ascending: false }).limit(1);
  let order = (prev?.[0]?.order_index ?? -1) + 1;
  const base = { plan_id: planId, routine_id: routineId };
  const rows = [];
  if (action === "replace") {
    rows.push({ ...base, from_week: week, action: "replace", item_key: itemKey, exercise_id: newExerciseId, sets, reps });
    if (nextWeek) rows.push({ ...base, from_week: nextWeek, action: "replace", item_key: itemKey, exercise_id: currentExerciseId });
  } else if (action === "remove") {
    rows.push({ ...base, from_week: week, action: "remove", item_key: itemKey });
    if (nextWeek) rows.push({ ...base, from_week: nextWeek, action: "replace", item_key: itemKey, exercise_id: currentExerciseId });
  } else if (action === "add") {
    const nk = newKey();
    rows.push({ ...base, from_week: week, action: "add", after_item_key: itemKey || null, new_item_key: nk, exercise_id: newExerciseId, sets, reps });
    if (nextWeek) rows.push({ ...base, from_week: nextWeek, action: "remove", item_key: nk });
  }
  // Un solo cambio (quitar / sustituir) por ejercicio y semana: el nuevo reemplaza al que había
  for (const r of rows) {
    if (r.action === "add") continue;
    await supabase.from("training_plan_exercise_changes").delete()
      .eq("plan_id", planId).eq("routine_id", routineId).eq("item_key", r.item_key).eq("from_week", r.from_week).neq("action", "add");
  }
  const { error } = await supabase.from("training_plan_exercise_changes").insert(rows.map((r) => ({ ...r, order_index: order++ })));
  if (error) throw fail("No se pudo guardar el cambio de ejercicio.", error);
}

// ---------- Semana base y extras ----------

// Peso del trabajo principal en la semana base = peso personalizado del alumno
export async function saveCustomWeight(studentId, exerciseId, kg) {
  const { error } = kg == null
    ? await supabase.from("student_exercise_weights").delete().eq("user_id", studentId).eq("exercise_id", exerciseId)
    : await supabase.from("student_exercise_weights").upsert({ user_id: studentId, exercise_id: exerciseId, target_weight_kg: kg }, { onConflict: "user_id,exercise_id" });
  if (error) throw fail("No se pudo guardar el peso.", error);
}

const flat = (content) => (content.mode === "bloques" ? content.blocks.flatMap((b) => b.exercises) : content.list);

// Devuelve la rutina que se puede editar para este alumno: la misma si ya es solo suya, o una copia nueva
// (con sus observaciones, comentarios y reloj) que reemplaza a la original en ese día o en ese extra.
export async function ensurePrivateRoutine({ studentId, part, dayLabel }) {
  if (part.student_id && String(part.student_id) === String(studentId)) return part.id;
  const content = await loadRoutineContent(part.id);
  const strip = (arr) => (arr || []).map((e) => ({ ...e, itemKey: null }));
  const blocks = content.blocks.map((b) => ({ ...b, exercises: strip(b.exercises) }));
  const list = strip(content.list);
  const { data: { user } } = await supabase.auth.getUser();
  const { data: r, error } = await supabase
    .from("routines")
    .insert({ title: part.title || "Rutina", level: part.level || "intermedio", goal: part.goal || "General", duration_minutes: Number(part.duration_minutes) || 0, created_by: user?.id, student_id: studentId })
    .select("id")
    .single();
  if (error || !r) throw fail("No se pudo crear la copia de la rutina para este alumno.", error);
  const wErr = await writeRoutineContent(r.id, content.mode, list, blocks, { timer: content.timer });
  if (wErr) {
    await supabase.from("routines").delete().eq("id", r.id);
    throw fail("No se pudo copiar la rutina.", wErr);
  }
  // Lo que el coach ya le había escrito a este alumno en la rutina original pasa a la copia
  const fresh = await loadRoutineContent(r.id);
  const oldItems = flat(content), newItems = flat(fresh);
  const keyMap = {};
  oldItems.forEach((it, i) => { if (it.itemKey && newItems[i]?.itemKey) keyMap[it.itemKey] = newItems[i].itemKey; });
  const [notes, rnotes, timers] = await Promise.all([
    supabase.from("student_exercise_notes").select("item_key, exercise_id, note").eq("user_id", studentId).eq("routine_id", part.id),
    supabase.from("student_routine_notes").select("block_index, note").eq("user_id", studentId).eq("routine_id", part.id),
    supabase.from("routine_timers").select("block_index, timer").eq("user_id", studentId).eq("routine_id", part.id),
  ]);
  const exNotes = (notes.data || []).filter((n) => keyMap[n.item_key]).map((n) => ({ user_id: studentId, routine_id: r.id, item_key: keyMap[n.item_key], exercise_id: n.exercise_id, note: n.note }));
  if (exNotes.length) await supabase.from("student_exercise_notes").insert(exNotes);
  if ((rnotes.data || []).length) await supabase.from("student_routine_notes").insert(rnotes.data.map((n) => ({ ...n, user_id: studentId, routine_id: r.id })));
  if ((timers.data || []).length) await supabase.from("routine_timers").insert(timers.data.map((t) => ({ ...t, user_id: studentId, routine_id: r.id })));

  // La copia reemplaza a la original: en el extra, o en ese día de su semana base
  if (part.isExtra && part.extraId) {
    const { error: e } = await supabase.from("student_extras").update({ routine_id: r.id }).eq("id", part.extraId);
    if (e) throw fail("La copia se creó, pero no se pudo poner en el extra.", e);
  } else {
    const { data: rows, error: e1 } = await supabase.from("routine_assignments").select("*").eq("user_id", studentId).eq("day_label", dayLabel);
    if (e1) throw fail("La copia se creó, pero no se pudo poner en el día.", e1);
    const swapped = (rows || []).map((x) => {
      const copy = { ...x, routine_id: String(x.routine_id) === String(part.id) ? r.id : x.routine_id };
      delete copy.id;
      delete copy.created_at;
      return copy;
    });
    const { error: e2 } = await supabase.from("routine_assignments").delete().eq("user_id", studentId).eq("day_label", dayLabel);
    if (e2) throw fail("La copia se creó, pero no se pudo poner en el día.", e2);
    const { error: e3 } = await supabase.from("routine_assignments").insert(swapped);
    if (e3) {
      if (rows?.length) await supabase.from("routine_assignments").insert(rows.map((x) => { const c = { ...x }; delete c.id; delete c.created_at; return c; }));
      throw fail("La copia se creó, pero no se pudo poner en el día.", e3);
    }
  }
  return { routineId: r.id, keyMap };
}

// Edita un ejercicio de una rutina (solo de este alumno).
// patch = { kg?, sets?, reps? } · action = null | "replace" | "remove" | "add"
export async function editRoutineExercise({ routineId, itemKey, patch = {}, action = null, newExercise = null, newSets = null, newReps = null }) {
  const content = await loadRoutineContent(routineId);
  const findIn = (arr) => (arr || []).findIndex((e) => String(e.itemKey) === String(itemKey));
  let block = null, arr = content.list, idx = findIn(content.list);
  if (content.mode === "bloques") {
    for (const b of content.blocks) {
      const i = findIn(b.exercises);
      if (i >= 0) { block = b; arr = b.exercises; idx = i; break; }
    }
  }
  if (idx < 0) throw new Error("No se encontró el ejercicio en la rutina. Recargue y vuelva a intentar.");
  const item = arr[idx];
  if (patch.kg !== undefined) item.targetWeight = patch.kg == null ? "" : String(patch.kg);
  if (patch.reps !== undefined) item.reps = patch.reps || "";
  if (patch.sets !== undefined) {
    if (block) block.sets = patch.sets ? String(patch.sets) : "";
    else item.sets = patch.sets ? String(patch.sets) : "";
  }
  if (action === "replace" && newExercise) {
    item.exerciseId = newExercise.id;
    item.name = newExercise.name;
    item.targetWeight = "";
    if (newReps) item.reps = newReps;
    if (newSets && !block) item.sets = String(newSets);
  } else if (action === "remove") {
    arr.splice(idx, 1);
  } else if (action === "add" && newExercise) {
    arr.splice(idx + 1, 0, { itemKey: null, exerciseId: newExercise.id, name: newExercise.name, reps: newReps || item.reps || "", targetWeight: "", restMinutes: item.restMinutes || "", sets: block ? "" : String(newSets || item.sets || "") });
  }
  const err = await writeRoutineContent(routineId, content.mode, content.list, content.blocks, { timer: content.timer });
  if (err) throw fail("No se pudo guardar el cambio en la rutina.", err);
}
