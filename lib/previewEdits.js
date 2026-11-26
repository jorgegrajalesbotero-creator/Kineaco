// Reglas para borrar y reordenar desde "Rutina como la ve el alumno" (lógica pura, con pruebas).
// La rutina de la biblioteca nunca se toca: se trabaja sobre una copia solo de ese alumno.

// Semanas del plan que cambian: "week" = solo esa semana · "from" = desde esa hasta el final del plan
export function planTargetWeeks(week, totalWeeks, scope) {
  const w = Number(week) || 1;
  const last = Math.max(w, Number(totalWeeks) || w);
  if (scope !== "from") return [w];
  return Array.from({ length: last - w + 1 }, (_, i) => w + i);
}

// ¿La rutina ya es solo de ese alumno y SOLO se usa en ese día y esas semanas del plan?
// Entonces se puede editar tal cual; si se usa en otro lado, hay que hacer otra copia.
export function canEditInPlace(routineId, schedule, planId, dayLabel, weeks) {
  const id = String(routineId);
  const uses = [];
  (schedule?.plans || []).forEach((p) => (p.training_plan_days || []).forEach((d) => {
    if (String(d.routine_id) === id) uses.push({ planId: String(p.id), day: d.day_label, week: Number(d.week_index) });
  }));
  if ((schedule?.fixed || []).some((a) => String(a.routine_id) === id)) return false;
  if ((schedule?.extras || []).some((x) => String(x.routine_id) === id)) return false;
  return uses.length > 0 && uses.every((u) => u.planId === String(planId) && u.day === dayLabel && weeks.includes(u.week));
}

// Suma días a una fecha "AAAA-MM-DD" (sin problemas de zona horaria)
export function addDaysISO(iso, n) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

// Quitar un extra de UN día de la semana. Devuelve los tramos que deben quedar (cada uno es una fila de
// student_extras): antes de esa semana queda igual; "week" = solo esa semana sin ese día y después igual;
// "from" = de esa semana en adelante sin ese día. Los tramos vacíos no se devuelven.
export function splitExtra(extra, mondayISO, dayLabel, scope) {
  const start = extra.start_date;
  const end = extra.end_date;
  const days = extra.days || [];
  const without = days.filter((d) => d !== dayLabel);
  const sunday = addDaysISO(mondayISO, 6);
  const nextMonday = addDaysISO(mondayISO, 7);
  const maxISO = (a, b) => (a > b ? a : b);
  const minISO = (a, b) => (a < b ? a : b);
  const parts = [
    { start_date: start, end_date: minISO(end, addDaysISO(mondayISO, -1)), days },
    scope === "from"
      ? { start_date: maxISO(start, mondayISO), end_date: end, days: without }
      : { start_date: maxISO(start, mondayISO), end_date: minISO(end, sunday), days: without },
  ];
  if (scope !== "from") parts.push({ start_date: maxISO(start, nextMonday), end_date: end, days });
  return parts.filter((p) => p.start_date <= p.end_date && p.days.length > 0);
}

// Nuevo orden de los bloques: lista de posiciones originales (blockIndex) después de mover from → to
export function movedOrder(indexes, from, to) {
  const out = [...indexes];
  const [it] = out.splice(from, 1);
  out.splice(to, 0, it);
  return out;
}
