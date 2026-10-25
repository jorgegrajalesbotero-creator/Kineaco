// Plan de entrenamiento por semanas: cada semana del plan tiene su rutina (o rutinas) por día.
// Mientras un plan cubre una fecha, manda el plan; fuera del plan se usan los días fijos (routine_assignments).
import { WEEK_DAYS, localDateString } from "@/lib/dates";

export const PLAN_MAX_WEEKS = 8;
export const PLAN_WEEK_OPTIONS = [4, 5, 6, 7, 8];

export const parseDate = (s) => new Date(`${s}T00:00:00`);
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function mondayOf(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export const dayLabelOf = (date) => WEEK_DAYS[(date.getDay() + 6) % 7];
export const planStart = (plan) => parseDate(plan.start_date);
export const planLastDay = (plan) => addDays(planStart(plan), plan.weeks * 7 - 1);

// Número de semana del plan (1, 2, ...) que contiene la fecha, o null si la fecha está fuera del plan
export function planWeekOf(plan, date) {
  const diff = Math.round((mondayOf(date) - planStart(plan)) / 86400000);
  const w = diff / 7 + 1;
  return Number.isInteger(w) && w >= 1 && w <= plan.weeks ? w : null;
}

export const planFor = (plans, date) => (plans || []).find((p) => planWeekOf(p, date) != null) || null;

const byOrder = (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0);

// Rutinas de una fecha: las del plan si hay plan esa semana; si no, las de los días fijos
export function routinesForDate(plans, fixed, date) {
  const label = dayLabelOf(date);
  const plan = planFor(plans, date);
  if (plan) {
    const week = planWeekOf(plan, date);
    const items = (plan.training_plan_days || [])
      .filter((d) => d.week_index === week && d.day_label === label && (d.routines || d.routine_id))
      .sort(byOrder)
      .map((d) => ({ day_label: label, order_index: d.order_index, routines: d.routines || { id: d.routine_id } }));
    return { plan, week, items };
  }
  const items = (fixed || []).filter((a) => a.day_label === label && a.routines).sort(byOrder);
  return { plan: null, week: null, items };
}

// Trae los planes del alumno (con sus días y rutinas) y sus días fijos
export async function loadSchedule(supabase, userId, routineFields = "*") {
  const [{ data: plans }, { data: fixed }] = await Promise.all([
    supabase
      .from("training_plans")
      .select(`*, training_plan_days(week_index, day_label, routine_id, order_index, routines(${routineFields}))`)
      .eq("user_id", userId)
      .order("start_date"),
    supabase
      .from("routine_assignments")
      .select(`day_label, order_index, routine_id, routines(${routineFields})`)
      .eq("user_id", userId)
      .order("order_index"),
  ]);
  return { plans: plans || [], fixed: fixed || [] };
}

// Plan que está corriendo hoy, o el próximo que va a empezar
export function currentOrNextPlan(plans, today = new Date()) {
  const now = planFor(plans, today);
  if (now) return now;
  const t = localDateString(today);
  return (plans || []).filter((p) => p.start_date > t).sort((a, b) => (a.start_date < b.start_date ? -1 : 1))[0] || null;
}

// Lunes desde el que conviene empezar un plan nuevo: el lunes de esta semana, o el día siguiente al último plan
export function suggestedStart(plans) {
  let start = mondayOf(new Date());
  (plans || []).forEach((p) => {
    const after = addDays(planLastDay(p), 1);
    if (after > start) start = after;
  });
  return localDateString(start);
}

export function plansOverlap(a, b) {
  const aStart = planStart(a), bStart = planStart(b);
  return aStart < addDays(bStart, b.weeks * 7) && bStart < addDays(aStart, a.weeks * 7);
}
