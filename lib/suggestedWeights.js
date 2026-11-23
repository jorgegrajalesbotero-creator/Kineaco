// Peso SUGERIDO que el alumno vio un día: el de su planeación de esa semana (con su tipo: ATR, lineal,
// progresión doble, ondulante, RIR…), si no su peso personalizado, si no el de la rutina.
// Carga cada planeación una sola vez y calcula cualquier fecha sin volver a la base.
import { WEEK_DAYS, localDateString } from "@/lib/dates";
import { loadMapForWeek } from "@/lib/loadCalc";
import { planFor, planWeekOf } from "@/lib/trainingPlan";
import { loadSetHistory } from "@/lib/studentRoutine";

export function makeSuggestedResolver(supabase, userId, unit = "kg") {
  let plansP = null;
  let customP = null;
  const planData = new Map(); // planId → Promise<{ phases, weekRows, loads, cellRows, history }>
  const mapCache = new Map(); // fecha → mapa de cargas del plan
  const routineTargets = new Map(); // routineId → Promise<{ "item:k" | "ex:id": kg }>

  const plans = () => (plansP ||= (async () => {
    let { data, error } = await supabase.from("training_plans").select("id, start_date, weeks, model, day_goals").eq("user_id", userId);
    if (error) ({ data } = await supabase.from("training_plans").select("id, start_date, weeks").eq("user_id", userId));
    return data || [];
  })());
  const custom = () => (customP ||= (async () => {
    const { data } = await supabase.from("student_exercise_weights").select("exercise_id, target_weight_kg").eq("user_id", userId);
    const m = {};
    (data || []).forEach((r) => { m[String(r.exercise_id)] = r.target_weight_kg; });
    return m;
  })());
  const dataOf = (plan) => {
    if (!planData.has(plan.id)) {
      planData.set(plan.id, (async () => {
        const [{ data: phases }, { data: weekRows }, { data: loads }, { data: cellRows }] = await Promise.all([
          supabase.from("training_plan_phases").select("*").eq("plan_id", plan.id),
          supabase.from("training_plan_weeks").select("*").eq("plan_id", plan.id),
          supabase.from("training_plan_loads").select("*").eq("plan_id", plan.id),
          supabase.from("training_plan_load_cells").select("*").eq("plan_id", plan.id),
        ]);
        const ids = [...new Set((loads || []).filter((l) => l.base_type === "double" || l.base_type === "rir").map((l) => String(l.exercise_id)))];
        const history = ids.length ? await loadSetHistory(supabase, userId, ids, plan.start_date) : null;
        return { phases: phases || [], weekRows, loads, cellRows, history };
      })());
    }
    return planData.get(plan.id);
  };
  const planMapFor = async (dateStr) => {
    if (mapCache.has(dateStr)) return mapCache.get(dateStr);
    const date = new Date(`${dateStr}T12:00:00`);
    const plan = planFor(await plans(), date);
    let map = null;
    if (plan) {
      const d = await dataOf(plan);
      const dayLabel = WEEK_DAYS[(date.getDay() + 6) % 7];
      const goal = plan.model === "ondulante_diaria" ? plan.day_goals?.[dayLabel] || null : null;
      map = loadMapForWeek({ phases: d.phases, totalWeeks: plan.weeks, weekRows: d.weekRows, loads: d.loads, cellRows: d.cellRows, week: planWeekOf(plan, date), unit, goal, history: d.history, startDate: plan.start_date, date: dateStr });
    }
    mapCache.set(dateStr, map);
    return map;
  };
  const targetsOf = (routineId) => {
    if (!routineTargets.has(routineId)) {
      routineTargets.set(routineId, (async () => {
        const { data } = await supabase.from("routine_exercises").select("exercise_id, item_key, target_weight_kg").eq("routine_id", routineId);
        const m = {};
        (data || []).forEach((t) => {
          if (t.target_weight_kg == null) return;
          if (t.item_key) m[`item:${t.item_key}`] = t.target_weight_kg;
          m[`ex:${t.exercise_id}`] ??= t.target_weight_kg;
        });
        return m;
      })());
    }
    return routineTargets.get(routineId);
  };

  // { date: "AAAA-MM-DD" | Date, exerciseId, routineId?, itemKey? } → kg o null
  return async function suggestedFor({ date, exerciseId, routineId = null, itemKey = null }) {
    const dateStr = typeof date === "string" ? date.slice(0, 10) : localDateString(date);
    const map = await planMapFor(dateStr);
    const fromPlan = map?.[String(exerciseId)]?.value;
    if (fromPlan != null) return Number(fromPlan);
    const c = (await custom())[String(exerciseId)];
    if (c != null) return Number(c);
    if (!routineId) return null;
    const t = await targetsOf(routineId);
    const v = (itemKey && t[`item:${itemKey}`]) ?? t[`ex:${exerciseId}`];
    return v == null ? null : Number(v);
  };
}
