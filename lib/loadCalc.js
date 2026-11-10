// Cálculo automático de cargas del plan unificado (coach y alumno usan lo mismo).
// Cada fase tiene % de inicio y fin; la app los reparte entre sus semanas.
// Cada ejercicio tiene una base (RM medido o peso × reps → RM estimado con Epley)
// y el peso de cada semana = RM × % de esa semana, redondeado.
// Las casillas editadas a mano mandan sobre el cálculo.
// Series: igual que el % y las reps, salen solas de la fase (series de inicio y fin
// repartidas entre sus semanas). Si la fase no tiene series escritas, se usan las
// de partida de su tipo (PHASE_DEFAULTS). Solo "Otro" sin series usa las de la rutina.
import { PHASE_TYPES, phaseType } from "@/lib/planning";
import { roundWeight } from "@/lib/weightUnits";

export const PHASE_DEFAULTS = {
  acumulacion: { pct_start: 65, pct_end: 75, reps_start: "10-12", reps_end: "8", sets_start: 3, sets_end: 4 },
  transformacion: { pct_start: 77.5, pct_end: 85, reps_start: "6-8", reps_end: "4-6", sets_start: 4, sets_end: 3 },
  realizacion: { pct_start: 87.5, pct_end: 92.5, reps_start: "3-4", reps_end: "1-3", sets_start: 3, sets_end: 2 },
  descarga: { pct_start: 55, pct_end: 60, reps_start: "10", reps_end: "10", sets_start: 2, sets_end: 2 },
  otro: { pct_start: null, pct_end: null, reps_start: "", reps_end: "", sets_start: null, sets_end: null },
};
export { PHASE_TYPES, phaseType };

export const EPLEY_MAX_REPS = 12;
const num = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};
const halfRound = (x) => Math.round(x * 2) / 2;
export const roundTo = (x, step) => Math.round(x / (step || 2.5)) * (step || 2.5);
export const fmtNum = (x) => (x == null ? "" : String(Math.round(x * 10) / 10).replace(".", ","));

const sortByOrder = (list) => [...(list || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

const intOrNull = (v) => {
  const n = num(v);
  return n == null || n <= 0 ? null : Math.round(n);
};
function setsBetween(start, end, i, n) {
  const a = intOrNull(start), b = intOrNull(end);
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null || n <= 1) return a;
  return Math.round(a + ((b - a) * i) / (n - 1));
}

function repsBetween(start, end, i, n) {
  const a = String(start || "").trim(), b = String(end || "").trim();
  if (!a && !b) return "";
  if (n <= 1 || !b) return a || b;
  if (!a) return b;
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return String(Math.round(Number(a) + ((Number(b) - Number(a)) * i) / (n - 1)));
  return i < n / 2 ? a : b;
}

// [{ week, phase, phaseIndex, weekInPhase, pct, reps, sets, pctAuto, repsAuto, setsAuto, pctEdited, repsEdited, setsEdited }]
// weekOverrides: { [week]: { pct, reps, sets } }
export function planWeeks(phases, totalWeeks, weekOverrides = {}) {
  const out = [];
  sortByOrder(phases).forEach((phase, phaseIndex) => {
    const n = Number(phase.weeks) || 0;
    const s = num(phase.pct_start), e = num(phase.pct_end);
    for (let i = 0; i < n; i++) {
      const pctAuto = s == null ? null : e == null || n <= 1 ? s : halfRound(s + ((e - s) * i) / (n - 1));
      const repsAuto = repsBetween(phase.reps_start, phase.reps_end, i, n);
      const own = intOrNull(phase.sets_start) != null || intOrNull(phase.sets_end) != null;
      const d = PHASE_DEFAULTS[phase.phase_type] || PHASE_DEFAULTS.otro;
      const setsAuto = own ? setsBetween(phase.sets_start, phase.sets_end, i, n) : setsBetween(d.sets_start, d.sets_end, i, n);
      out.push({ week: out.length + 1, phase, phaseIndex, weekInPhase: i + 1, pctAuto, repsAuto, setsAuto });
    }
  });
  const total = Math.max(totalWeeks || 0, out.length);
  for (let w = out.length + 1; w <= total; w++) out.push({ week: w, phase: null, phaseIndex: -1, weekInPhase: 0, pctAuto: null, repsAuto: "", setsAuto: null });
  return out.slice(0, total).map((w) => {
    const ov = weekOverrides[w.week] || {};
    const pctEdited = num(ov.pct) != null;
    const repsEdited = !!(ov.reps && String(ov.reps).trim());
    const setsEdited = intOrNull(ov.sets) != null;
    return {
      ...w,
      pct: pctEdited ? num(ov.pct) : w.pctAuto,
      reps: repsEdited ? String(ov.reps).trim() : w.repsAuto,
      sets: setsEdited ? intOrNull(ov.sets) : w.setsAuto,
      pctEdited, repsEdited, setsEdited,
    };
  });
}

// RM de una base: medido, o estimado con Epley si es peso × reps
export function rmOf(load) {
  const w = num(load?.weight_kg);
  if (w == null) return null;
  if (load.base_type !== "work") return w;
  const r = num(load.reps) || 1;
  return r <= 1 ? w : w * (1 + r / 30);
}

// Base que rige en una semana: la de from_week más alto que no pase esa semana
export function baseFor(loads, exerciseId, week) {
  return (loads || [])
    .filter((l) => String(l.exercise_id) === String(exerciseId) && (Number(l.from_week) || 1) <= week && num(l.weight_kg) != null)
    .sort((a, b) => (Number(b.from_week) || 1) - (Number(a.from_week) || 1))[0] || null;
}

export const cellKey = (exerciseId, week) => `${exerciseId}:${week}`;

// Peso de un ejercicio en una semana
// cells: { "exId:week": { value, reps, sets } }  (casillas editadas a mano)
// unit: unidad de quien lo ve. Los pesos van siempre en kg, pero el cálculo automático se
// redondea en esa unidad (2,5 kg o 5 lb) para que salgan números redondos de discos.
export function loadFor({ weeks, loads, cells = {}, exerciseId, week, unit = "kg" }) {
  const info = weeks[week - 1];
  const base = baseFor(loads, exerciseId, week);
  const cell = cells[cellKey(exerciseId, week)];
  const rm = base ? rmOf(base) : null;
  const pct = info?.pct ?? null;
  const raw = rm != null && pct != null ? (rm * pct) / 100 : null;
  const auto = raw == null ? null : unit === "lb" ? roundWeight(raw, base.rounding, "lb") : roundTo(raw, Number(base.rounding) || 2.5);
  const manualKg = num(cell?.value);
  const kg = manualKg != null ? manualKg : auto;
  const reps = (cell?.reps && String(cell.reps).trim()) || (base || manualKg != null ? info?.reps || "" : "");
  const manualSets = intOrNull(cell?.sets);
  const sets = manualSets != null ? manualSets : base || manualKg != null ? info?.sets ?? null : null;
  return {
    kg,
    auto,
    pct: kg != null && rm ? Math.round((kg / rm) * 1000) / 10 : pct,
    reps,
    manual: manualKg != null,
    repsManual: !!(cell?.reps && String(cell.reps).trim()),
    sets,
    setsAuto: base || manualKg != null ? info?.sets ?? null : null,
    setsManual: manualSets != null,
    rm,
    estimated: base?.base_type === "work",
    base,
  };
}

// Mapa para el alumno: { [exerciseId]: { value_type: "kg", value, reps, sets } } de la semana indicada
export function loadMapForWeek({ phases, totalWeeks, weekRows, loads, cellRows, week, unit = "kg" }) {
  const overrides = {};
  (weekRows || []).forEach((r) => { overrides[r.week_index] = { pct: r.pct, reps: r.reps, sets: r.sets }; });
  const weeks = planWeeks(phases, totalWeeks, overrides);
  const cells = {};
  (cellRows || []).forEach((c) => { cells[cellKey(c.exercise_id, c.week_index)] = { value: c.value, reps: c.reps, sets: c.sets }; });
  const ids = new Set([...(loads || []).map((l) => String(l.exercise_id)), ...(cellRows || []).filter((c) => c.week_index === week).map((c) => String(c.exercise_id))]);
  const map = {};
  ids.forEach((id) => {
    const r = loadFor({ weeks, loads, cells, exerciseId: id, week, unit });
    if (r.kg != null || r.reps || r.sets) map[id] = { value_type: "kg", value: r.kg, reps: r.reps || null, sets: r.sets || null };
  });
  return map;
}
