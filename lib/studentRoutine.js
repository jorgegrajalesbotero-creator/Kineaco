// Arma la rutina del día de un alumno tal como la ve él: plan por semanas (o días fijos), cargas de la semana,
// cambios de ejercicios del plan, pesos personalizados, lo que ya marcó esa semana y las observaciones del coach.
// La usan la app del alumno (app/page.js) y el coach en "Ver rutina como el alumno".
import { blockUsesProgression } from "@/lib/blocks";
import { WEEK_DAYS } from "@/lib/dates";
import { tr } from "@/lib/i18n";
import { loadMapForWeek } from "@/lib/loadCalc";
import { applyPlanChanges } from "@/lib/planChanges";
import { loadExerciseNotes, noteFor } from "@/lib/exerciseNotes";
import { addDays, loadSchedule, mondayOf, planFor, planWeekOf, routinesForDate } from "@/lib/trainingPlan";
import { getWeightUnit } from "@/lib/weightUnits";

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

// Cargas de la semana del plan que contiene la fecha (fases + RM → peso calculado, o casillas escritas por el coach)
// + los cambios de ejercicios del plan (quitar / sustituir / agregar desde una semana)
export async function loadPlanContext(supabase, uid, date = new Date()) {
  const { data: plans } = await supabase.from("training_plans").select("id, start_date, weeks").eq("user_id", uid);
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
  return {
    map: loadMapForWeek({ phases: phases || [], totalWeeks: plan.weeks, weekRows, loads, cellRows, week, unit: getWeightUnit() }),
    changes: changes || [],
    week,
  };
}

// Una rutina asignada (assignment = { day_label, routines: { id, ... } }) con todos sus ejercicios listos para mostrar
export async function buildRoutine(supabase, uid, assignment, { date = new Date(), planCtx = null, notes = null } = {}) {
  const routineId = assignment.routines.id;
  const weekStart = mondayOf(date);
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
      .select("exercise_id, item_key")
      .eq("user_id", uid)
      .eq("routine_id", routineId)
      .eq("day_label", assignment.day_label)
      .gte("completed_at", weekStart.toISOString())
      .lt("completed_at", addDays(weekStart, 7).toISOString()),
    notes || loadExerciseNotes(supabase, uid, [routineId]),
  ]);

  const customWeightMap = {};
  (customWeights || []).forEach((c) => { customWeightMap[c.exercise_id] = c.target_weight_kg; });
  const blockList = blocks || [];
  const blockMap = {};
  blockList.forEach((b) => { blockMap[b.id] = b; });
  const progressionMap = ctx.map;
  // Cambios de ejercicios de su plan (la rutina original no cambia)
  const exercises = applyPlanChanges(routineExercises || [], ctx.changes, routineId, ctx.week);
  // Si un ejercicio está también en el trabajo principal, la progresión va solo ahí
  const mainIds = new Set(exercises.filter((x) => blockUsesProgression(x.block_id ? blockMap[x.block_id]?.block_type : null)).map((x) => String(x.exercise_id)));
  const hasBlocks = blockList.length > 0;
  const doneItemKeys = new Set((progressRows || []).filter((p) => p.item_key).map((p) => p.item_key));
  const doneExerciseIds = new Set((progressRows || []).map((p) => p.exercise_id));

  return {
    ...assignment.routines,
    day_label: assignment.day_label,
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
          return [setsN ? tr("{p0} series", { p0: setsN }) : "", reps ? tr("{p0} reps", { p0: reps }) : ""].filter(Boolean).join(" × ");
        },
        get rowLabel() {
          if (!block) return null;
          if (setsDiffer) return [tr("{p0} series", { p0: planSets }), reps ? tr("{p0} reps", { p0: reps }) : ""].filter(Boolean).join(" × ");
          return reps ? tr("{p0} reps", { p0: reps }) : "";
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
        // Observación del coach para este alumno (no cambia la rutina ni la planeación)
        note: noteFor(noteMap, routineId, e.item_key, e.exercise_id),
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
  const valid = routinesForDate(sched.plans, sched.fixed, date).items;
  if (valid.length === 0) return null;

  const [planCtx, notes] = await Promise.all([
    loadPlanContext(supabase, uid, date),
    loadExerciseNotes(supabase, uid, valid.map((a) => a.routines.id)),
  ]);
  const parts = await Promise.all(valid.map((a) => buildRoutine(supabase, uid, a, { date, planCtx, notes })));
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
    planChanges: parts[0].planChanges || [],
    planWeek: parts[0].planWeek || 0,
  };
}
