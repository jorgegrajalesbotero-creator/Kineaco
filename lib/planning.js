// Planeación por fases (mesociclos). Solo la usa el coach.
// Un plan es una fecha de inicio + una lista ordenada de fases, cada una con
// tipo, nombre opcional y cantidad de semanas. Las fechas se calculan solas.

export const PHASE_TYPES = [
  { key: "acumulacion", label: "Acumulación", color: "#5CC8FF" },
  { key: "transformacion", label: "Transformación", color: "#FFB547" },
  { key: "realizacion", label: "Realización", color: "#FF6B4A" },
  { key: "descarga", label: "Descarga", color: "#B48CFF" },
  { key: "otro", label: "Otro", color: "#8A9690" },
];

export function phaseType(key) {
  return PHASE_TYPES.find((t) => t.key === key) || PHASE_TYPES[PHASE_TYPES.length - 1];
}

export function phaseDisplayName(phase) {
  const custom = (phase?.name || "").trim();
  return custom || phaseType(phase?.phase_type).label;
}

export function sortPhases(phases) {
  return [...(phases || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

export function totalPlanWeeks(phases) {
  return (phases || []).reduce((sum, p) => sum + (Number(p.weeks) || 0), 0);
}

// [{ week: 1, phase, phaseIndex, weekInPhase }, ...]
export function expandPlanWeeks(phases) {
  const out = [];
  sortPhases(phases).forEach((phase, phaseIndex) => {
    const n = Number(phase.weeks) || 0;
    for (let i = 1; i <= n; i++) out.push({ week: out.length + 1, phase, phaseIndex, weekInPhase: i });
  });
  return out;
}

export function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = String(str).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function toDateStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function mondayOf(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  return addDays(d, -dow);
}

export function weekStartDate(startStr, week) {
  return addDays(parseDate(startStr), 7 * (week - 1));
}

// Número de semana del plan para una fecha (puede ser < 1 si todavía no empezó)
export function planWeekForDate(startStr, date) {
  const start = parseDate(startStr);
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const days = Math.round((d - start) / 86400000);
  return Math.floor(days / 7) + 1;
}

export function formatShortDate(date) {
  return new Date(date).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

// Resumen de dónde va el alumno hoy
export function planStatus(plan, today = new Date()) {
  if (!plan) return { state: "none", label: "Sin plan" };
  const weeks = expandPlanWeeks(plan.phases);
  const total = weeks.length;
  if (total === 0) return { state: "empty", label: "Plan sin fases" };
  const w = planWeekForDate(plan.start_date, today);
  if (w < 1) return { state: "future", label: `Empieza el ${formatShortDate(parseDate(plan.start_date))}`, total };
  if (w > total) return { state: "done", label: "Plan terminado", total };
  const info = weeks[w - 1];
  return {
    state: "active",
    week: w,
    total,
    phase: info.phase,
    label: `Semana ${w} de ${total} · ${phaseDisplayName(info.phase)}`,
  };
}

// Semanas por tipo, para guardar en load_progressions cuando hay plan
export function atrSplit(phases) {
  let acc = 0, trans = 0, real = 0;
  (phases || []).forEach((p) => {
    const n = Number(p.weeks) || 0;
    if (p.phase_type === "acumulacion") acc += n;
    else if (p.phase_type === "transformacion") trans += n;
    else real += n;
  });
  return { accumulation_weeks: acc, transformation_weeks: trans, realization_weeks: real };
}
