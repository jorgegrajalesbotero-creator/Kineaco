// Arma la rutina del día de un alumno tal como la ve él: plan por semanas (o días fijos), cargas de la semana,
// cambios de ejercicios del plan, pesos personalizados, lo que ya marcó esa semana y las observaciones del coach.
// La usan la app del alumno (app/page.js) y el coach en "Ver rutina como el alumno".
import { blockUsesProgression } from "@/lib/blocks";
import { WEEK_DAYS, localDateString } from "@/lib/dates";
import { fetchAllRows } from "@/lib/fetchAll";
import { tr } from "@/lib/i18n";
import { loadMapForWeek } from "@/lib/loadCalc";
import { applyPlanChanges } from "@/lib/planChanges";
import { loadExerciseNotes, noteFor } from "@/lib/exerciseNotes";
import { commentKey, loadExerciseComments } from "@/lib/exerciseComments";
import { addDays, loadSchedule, mondayOf, planFor, planWeekOf, routinesForDate } from "@/lib/trainingPlan";
import { getWeightUnit } from "@/lib/weightUnits";
import { LIST_TIMER_INDEX, loadTimers, timersFor } from "@/lib/routineTimers";
import { ROUTINE_NOTE_INDEX, loadRoutineNotes, notesFor } from "@/lib/routineNotes";

export function resolveTargetWeight(exerciseId, generalWeight, customWeight, progressionMap) {
  const p = progressionMap[exerciseId];
  if (p && p.value != null) {
    if (p.value_type === "percent") {
      const base = customWeight ?? generalWeight;
      if (base != null) return Math.round(base * (p.value / 100) * 100) / 100;
    } else {
      return p.value;
    }
  }
  return customWeight ?? generalWeight;
}

// Contexto vacío: para los extras (remates, intermitentes, entrenos adicionales), que NO usan el ATR
export const NO_PLAN = { map: {}, changes: [], week: 0 };

// Cargas de la semana del plan que contiene la fecha (fases + RM → peso calculado, o casillas escritas por el coach)
// + los cambios de ejercicios del plan (quitar / sustituir / agregar desde una semana)
export async function loadPlanContext(supabase, uid, date = new Date()) {
  // model y day_goals vienen con el SQL de tipos de planeación; si todavía no está, se usa lo de siempre
  let { data: plans, error } = await supabase.from("training_plans").select("id, start_date, weeks, model, day_goals").eq("user_id", uid);
  if (error) ({ data: plans } = await supabase.from("training_plans").select("id, start_date, weeks").eq("user_id", uid));
  const plan = planFor(plans || [], date);
  if (!plan) return { map: {}, changes: [], week: 0 };
  const week = planWeekOf(plan, date);
  const [{ data: phases }, { data: weekRows }, { data: loads }, { data: cellRows }, { data: changes }] = await Promise.all([
    supabase.from("training_plan_phases").select("*").eq("plan_id", plan.id),
    supabase.from("training_plan_weeks").select("*").eq("plan_id", plan.id),
    supabase.from("training_plan_loads").select("*").eq("plan_id", plan.id),
    supabase.from("training_plan_load_cells").select("*").eq("plan_id", plan.id),
    supabase.from("training_plan_exercise_changes").select("*, exercises(name, video_url)").eq("plan_id", plan.id),
  ]);
  // Ondulante diaria: objetivo del día (lunes = 0 en WEEK_DAYS)
  const dayLabel = WEEK_DAYS[(new Date(date).getDay() + 6) % 7];
  const goal = plan.model === "ondulante_diaria" ? plan.day_goals?.[dayLabel] || null : null;
  // Progresión doble y autorregulada: leen lo que el alumno registró desde que empezó el plan
  const historyIds = [...new Set((loads || []).filter((l) => l.base_type === "double" || l.base_type === "rir").map((l) => String(l.exercise_id)))];
  const history = historyIds.length ? await loadSetHistory(supabase, uid, historyIds, plan.start_date) : null;
  return {
    map: loadMapForWeek({ phases: phases || [], totalWeeks: plan.weeks, weekRows, loads, cellRows, week, unit: getWeightUnit(), goal, history, startDate: plan.start_date, date: localDateString(new Date(date)) }),
    changes: changes || [],
    week,
  };
}

// Series registradas por el alumno, por ejercicio: { [exerciseId]: [{ date, weight, reps, rir }] }
export async function loadSetHistory(supabase, uid, exerciseIds, fromDate) {
  const probe = await supabase.from("progress_sets").select("rir").limit(1);
  const cols = probe.error ? "exercise_id, weight_kg, reps, completed_at" : "exercise_id, weight_kg, reps, rir, completed_at";
  const rows = await fetchAllRows(() => {
    let q = supabase.from("progress_sets").select(cols).eq("user_id", uid).in("exercise_id", exerciseIds);
    if (fromDate) q = q.gte("completed_at", new Date(`${String(fromDate).slice(0, 10)}T00:00:00`).toISOString());
    return q.order("completed_at");
  });
  const map = {};
  rows.forEach((r) => {
    const k = String(r.exercise_id);
    (map[k] = map[k] || []).push({ date: localDateString(new Date(r.completed_at)), weight: r.weight_kg, reps: r.reps, rir: r.rir ?? null });
  });
  return map;
}

// Una rutina asignada (assignment = { day_label, routines: { id, ... } }) con todos sus ejercicios listos para mostrar
export async function buildRoutine(supabase, uid, assignment, { date = new Date(), planCtx = null, notes = null, timers = null, comments = null } = {}) {
  const routineId = assignment.routines.id;
  const weekStart = mondayOf(date);
  // Comentarios que el alumno le dejó a su coach en cada ejercicio (ese día de esa semana)
  const commentMap = comments || (await loadExerciseComments(supabase, uid, localDateString(weekStart), assignment.day_label, [routineId]));
  const [{ data: routineExercises }, { data: blocks }, { data: customWeights }, ctx, { data: progressRows }, noteMap] = await Promise.all([
    supabase
      .from("routine_exercises")
      .select("exercise_id, block_id, item_key, sets, reps, order_index, target_weight_kg, rest_minutes, exercises(name, video_url)")
      .eq("routine_id", routineId)
      .order("order_index"),
    supabase
      .from("routine_blocks")
      .select("id, block_type, title, sets, notes, order_index")
      .eq("routine_id", routineId)
      .order("order_index"),
    supabase.from("student_exercise_weights").select("exercise_id, target_weight_kg").eq("user_id", uid),
    planCtx || loadPlanContext(supabase, uid, date),
    supabase
      .from("progress")
      .select("routine_id, exercise_id, item_key")
      .eq("user_id", uid)
      .eq("day_label", assignment.day_label)
      .gte("completed_at", weekStart.toISOString())
      .lt("completed_at", addDays(weekStart, 7).toISOString()),
    notes || loadExerciseNotes(supabase, uid, [routineId]),
  ]);
  // Reloj programado por el coach en cada bloque (el del alumno manda sobre el de la rutina)
  const timerMap = timersFor(timers || (await loadTimers(supabase, [routineId], uid)), routineId, uid);
  // Comentarios que el coach le escribió a ESTE alumno: pisan los que trae la rutina
  const comentarios = notesFor(await loadRoutineNotes(supabase, [routineId], uid), routineId);

  const customWeightMap = {};
  (customWeights || []).forEach((c) => { customWeightMap[c.exercise_id] = c.target_weight_kg; });
  const blockList = (blocks || []).map((b, i) => {
    const idx = b.order_index ?? i;
    const t = timerMap[idx];
    const notaAlumno = comentarios[idx];
    return {
      ...b,
      blockIndex: idx,
      timer: t?.timer || null,
      timerCustom: !!t?.custom,
      timerBase: t?.base || null,
      // La nota del alumno manda; se guarda la de la rutina para poder volver a ella
      notes: notaAlumno || b.notes || "",
      notesCustom: !!notaAlumno,
      notesBase: b.notes || "",
    };
  });
  const blockMap = {};
  blockList.forEach((b) => { blockMap[b.id] = b; });
  const progressionMap = ctx.map;
  // Cambios de ejercicios de su plan (la rutina original no cambia)
  const exercises = applyPlanChanges(routineExercises || [], ctx.changes, routineId, ctx.week);
  // Si un ejercicio está también en el trabajo principal, la progresión va solo ahí
  const mainIds = new Set(exercises.filter((x) => blockUsesProgression(x.block_id ? blockMap[x.block_id]?.block_type : null)).map((x) => String(x.exercise_id)));
  const hasBlocks = blockList.length > 0;
  // Lo hecho se reconoce por la clave del ejercicio aunque se haya marcado en la rutina anterior
  // (el coach la cambió en vivo y la copia conserva las claves). Sin clave, solo vale en esta rutina.
  const myKeys = new Set((routineExercises || []).map((e) => e.item_key).filter(Boolean));
  const doneItemKeys = new Set((progressRows || []).filter((p) => p.item_key && (myKeys.has(p.item_key) || String(p.routine_id) === String(routineId))).map((p) => p.item_key));
  const doneExerciseIds = new Set((progressRows || []).filter((p) => String(p.routine_id) === String(routineId)).map((p) => p.exercise_id));

  return {
    ...assignment.routines,
    day_label: assignment.day_label,
    isExtra: !!assignment.isExtra,
    extraId: assignment.extraId || null,
    // Reloj de toda la rutina (rutinas en "lista simple")
    ...(() => {
      const t = !hasBlocks ? timerMap[LIST_TIMER_INDEX] : null;
      return { timer: t?.timer || null, timerCustom: !!t?.custom, timerBase: t?.base || null, blockIndex: LIST_TIMER_INDEX };
    })(),
    // Comentario del día que el coach le dejó a este alumno (va arriba de la rutina)
    dayNote: comentarios[ROUTINE_NOTE_INDEX] || "",
    planChanges: ctx.changes,
    planWeek: ctx.week,
    blocks: hasBlocks ? blockList : [],
    exercises: (exercises || []).map((e) => {
      const block = e.block_id ? blockMap[e.block_id] : null;
      const blockSets = block?.sets ?? e.sets;
      const usesProgression = blockUsesProgression(block?.block_type);
      // El plan aplica en el trabajo principal y también en los demás bloques cuando el coach le hizo progresión a ese ejercicio
      const planApplies = !!progressionMap[e.exercise_id] && (usesProgression || !mainIds.has(String(e.exercise_id)));
      const reps = (planApplies && progressionMap[e.exercise_id]?.reps) || e.reps;
      // RIR (autorregulada) y tipo de progresión del ejercicio en el plan
      const planEntry = planApplies ? progressionMap[e.exercise_id] : null;
      const targetRir = planEntry?.rir ?? null;
      const rirLabel = targetRir != null ? tr("RIR {p0}", { p0: String(targetRir).replace(".", ",") }) : "";
      // Series: las de la semana del plan (si las tiene) mandan sobre las de la rutina o el bloque
      const planSets = planApplies ? progressionMap[e.exercise_id]?.sets || null : null;
      const routineSets = block ? blockSets : e.sets;
      const setsN = planSets || routineSets;
      const setsDiffer = !!(block && planSets && Number(planSets) !== Number(blockSets));
      return {
        exerciseId: e.exercise_id,
        itemKey: e.item_key,
        blockId: block ? block.id : null,
        name: e.exercises?.name || "Ejercicio",
        get sets() {
          return [[setsN ? tr("{p0} series", { p0: setsN }) : "", reps ? tr("{p0} reps", { p0: reps }) : ""].filter(Boolean).join(" × "), rirLabel].filter(Boolean).join(" · ");
        },
        get rowLabel() {
          if (!block) return null;
          if (setsDiffer) return [[tr("{p0} series", { p0: planSets }), reps ? tr("{p0} reps", { p0: reps }) : ""].filter(Boolean).join(" × "), rirLabel].filter(Boolean).join(" · ");
          return [reps ? tr("{p0} reps", { p0: reps }) : "", rirLabel].filter(Boolean).join(" · ");
        },
        videoUrl: e.exercises?.video_url || "",
        completed: hasBlocks ? doneItemKeys.has(e.item_key) : doneExerciseIds.has(e.exercise_id),
        targetWeight: usesProgression
          ? resolveTargetWeight(e.exercise_id, e.target_weight_kg, customWeightMap[e.exercise_id], progressionMap)
          : planApplies && progressionMap[e.exercise_id]?.value != null
            ? progressionMap[e.exercise_id].value
            : e.target_weight_kg,
        restMinutes: e.rest_minutes,
        setsCount: parseInt(setsN, 10) || 0,
        targetReps: reps ? String(reps) : "",
        targetRir,
        progressKind: planEntry?.kind || null,
        // Observación del coach para este alumno (no cambia la rutina ni la planeación)
        note: noteFor(noteMap, routineId, e.item_key, e.exercise_id),
        // Comentario del alumno para su coach
        studentComment: (commentMap[commentKey(routineId, e.item_key, e.exercise_id)] || (e.item_key ? commentMap[commentKey("*", e.item_key, e.exercise_id)] : null))?.comment || "",
      };
    }),
  };
}

// Fecha de un día ("Lunes"...) de la semana actual (weekOffset = 0), la siguiente (1), la anterior (-1)...
export const dateOfDay = (day, weekOffset = 0) =>
  addDays(mondayOf(new Date()), weekOffset * 7 + Math.max(0, WEEK_DAYS.indexOf(day)));

// Rutina(s) de un día: las del plan si hay un plan activo esa semana; si no, las de sus días fijos
export async function buildDay(supabase, uid, day, { weekOffset = 0, schedule = null } = {}) {
  const sched = schedule || (await loadSchedule(supabase, uid, "*"));
  const date = dateOfDay(day, weekOffset);
  const valid = routinesForDate(sched.plans, sched.fixed, date, sched.extras).items;
  if (valid.length === 0) return null;

  const ids = valid.map((a) => a.routines.id);
  const [planCtx, notes, timers, comments] = await Promise.all([
    loadPlanContext(supabase, uid, date),
    loadExerciseNotes(supabase, uid, ids),
    loadTimers(supabase, ids, uid),
    loadExerciseComments(supabase, uid, localDateString(mondayOf(date)), day, ids),
  ]);
  // Los extras se arman sin el plan: sus pesos, series y reps son los de su rutina (el ATR no cambia)
  const parts = await Promise.all(valid.map((a) => buildRoutine(supabase, uid, a, { date, planCtx: a.isExtra ? NO_PLAN : planCtx, notes, timers, comments })));
  parts.forEach((p, partIndex) => {
    p.partIndex = partIndex;
    p.exercises.forEach((e) => {
      e.routineId = p.id;
      e.partIndex = partIndex;
      e.byItem = p.blocks.length > 0;
    });
  });

  return {
    id: parts[0].id,
    title: parts.map((p) => p.title).join(" + "),
    get goal() { return parts.length > 1 ? tr("{p0} rutinas", { p0: parts.length }) : parts[0].goal; },
    duration_minutes: parts.reduce((sum, p) => sum + (Number(p.duration_minutes) || 0), 0),
    day_label: day,
    parts,
    blocks: [],
    exercises: parts.flatMap((p) => p.exercises),
    planChanges: parts.find((p) => !p.isExtra)?.planChanges || [],
    planWeek: parts.find((p) => !p.isExtra)?.planWeek || 0,
  };
}
