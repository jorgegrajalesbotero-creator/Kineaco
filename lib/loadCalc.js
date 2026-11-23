// Cálculo automático de cargas del plan unificado (coach y alumno usan lo mismo).
// Cada fase tiene % de inicio y fin; la app los reparte entre sus semanas.
// Cada ejercicio tiene una base (RM medido o peso × reps → RM estimado con Epley)
// y el peso de cada semana = RM × % de esa semana, redondeado.
// Las casillas editadas a mano mandan sobre el cálculo.
// Series: igual que el % y las reps, salen solas de la fase (series de inicio y fin
// repartidas entre sus semanas). Si la fase no tiene series escritas, se usan las
// de partida de su tipo (PHASE_DEFAULTS). Solo "Otro" sin series usa las de la rutina.
//
// Otros tipos de planeación (lib/planModels.js) usan este mismo motor:
// - RIR (autorregulada): la fase tiene RIR de inicio y fin. Si la fase no tiene %, el % sale
//   solo de las reps + RIR (Epley). Base "rir" = sin RM: el peso sale del último registro del alumno.
// - Progresión doble: base "double" = peso inicial + rango de reps; cada sesión en que el alumno
//   llega al tope del rango en todas las series, el peso sube solo.
// - Ondulante diaria: cada día de la semana tiene un objetivo (DAY_GOALS) que ajusta % , reps y series.
import { PHASE_TYPES, phaseType } from "@/lib/planning";
import { roundWeight } from "@/lib/weightUnits";

export const PHASE_DEFAULTS = {
  acumulacion: { pct_start: 65, pct_end: 75, reps_start: "10-12", reps_end: "8", sets_start: 3, sets_end: 4 },
  transformacion: { pct_start: 77.5, pct_end: 85, reps_start: "6-8", reps_end: "4-6", sets_start: 4, sets_end: 3 },
  realizacion: { pct_start: 87.5, pct_end: 92.5, reps_start: "3-4", reps_end: "1-3", sets_start: 3, sets_end: 2 },
  descarga: { pct_start: 55, pct_end: 60, reps_start: "10", reps_end: "10", sets_start: 2, sets_end: 2 },
  resistencia: { pct_start: 55, pct_end: 62.5, reps_start: "15", reps_end: "12", sets_start: 3, sets_end: 3 },
  hipertrofia: { pct_start: 67.5, pct_end: 75, reps_start: "12", reps_end: "10", sets_start: 3, sets_end: 4 },
  fuerza: { pct_start: 77.5, pct_end: 85, reps_start: "8", reps_end: "6", sets_start: 4, sets_end: 4 },
  maxima: { pct_start: 87.5, pct_end: 92.5, reps_start: "5", reps_end: "3", sets_start: 4, sets_end: 3 },
  progresion: { pct_start: 70, pct_end: 80, reps_start: "", reps_end: "", sets_start: 3, sets_end: 4 },
  otro: { pct_start: null, pct_end: null, reps_start: "", reps_end: "", sets_start: null, sets_end: null },
};
export { PHASE_TYPES, phaseType };

// Objetivos del día (periodización ondulante diaria): ajustan el % de la semana, cambian las reps
// y suman o restan series.
export const DAY_GOALS = [
  { key: "fuerza", label: "Fuerza", pct: 7.5, reps: "4-6", sets: 1 },
  { key: "hipertrofia", label: "Hipertrofia", pct: 0, reps: "8-10", sets: 0 },
  { key: "potencia", label: "Potencia", pct: -10, reps: "3-5", sets: 0 },
  { key: "resistencia", label: "Resistencia", pct: -12.5, reps: "12-15", sets: -1 },
];
export const dayGoal = (key) => DAY_GOALS.find((g) => g.key === key) || null;

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
// RIR: 0 a 10, de a medio punto (0 es válido: "al fallo")
const rirOrNull = (v) => {
  const n = num(v);
  return n == null || n < 0 ? null : Math.min(10, halfRound(n));
};
function setsBetween(start, end, i, n) {
  const a = intOrNull(start), b = intOrNull(end);
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null || n <= 1) return a;
  return Math.round(a + ((b - a) * i) / (n - 1));
}
function rirBetween(start, end, i, n) {
  const a = rirOrNull(start), b = rirOrNull(end);
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null || n <= 1) return a;
  return halfRound(a + ((b - a) * i) / (n - 1));
}

function repsBetween(start, end, i, n) {
  const a = String(start || "").trim(), b = String(end || "").trim();
  if (!a && !b) return "";
  if (n <= 1 || !b) return a || b;
  if (!a) return b;
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return String(Math.round(Number(a) + ((Number(b) - Number(a)) * i) / (n - 1)));
  return i < n / 2 ? a : b;
}

// Número más alto de unas reps ("8-10" → 10, "6" → 6)
export function topReps(reps) {
  const all = String(reps || "").match(/\d+/g);
  return all ? Math.max(...all.map(Number)) : null;
}

// % del RM para hacer esas reps dejando ese RIR (Epley con reps + RIR)
export function pctFromRir(reps, rir) {
  const top = topReps(reps);
  if (top == null || rir == null) return null;
  return halfRound(100 / (1 + (top + rir) / 30));
}

// [{ week, phase, phaseIndex, weekInPhase, pct, reps, sets, rir, pctAuto, repsAuto, setsAuto, rirAuto, pctEdited, repsEdited, setsEdited, rirEdited }]
// weekOverrides: { [week]: { pct, reps, sets, rir } }
export function planWeeks(phases, totalWeeks, weekOverrides = {}) {
  const out = [];
  sortByOrder(phases).forEach((phase, phaseIndex) => {
    const n = Number(phase.weeks) || 0;
    const s = num(phase.pct_start), e = num(phase.pct_end);
    for (let i = 0; i < n; i++) {
      const repsAuto = repsBetween(phase.reps_start, phase.reps_end, i, n);
      const rirAuto = rirBetween(phase.rir_start, phase.rir_end, i, n);
      // Sin % en la fase, pero con RIR: el % sale de las reps y el RIR
      const fromRir = s == null && rirAuto != null;
      const pctAuto = s == null ? (fromRir ? pctFromRir(repsAuto, rirAuto) : null) : e == null || n <= 1 ? s : halfRound(s + ((e - s) * i) / (n - 1));
      const own = intOrNull(phase.sets_start) != null || intOrNull(phase.sets_end) != null;
      const d = PHASE_DEFAULTS[phase.phase_type] || PHASE_DEFAULTS.otro;
      const setsAuto = own ? setsBetween(phase.sets_start, phase.sets_end, i, n) : setsBetween(d.sets_start, d.sets_end, i, n);
      out.push({ week: out.length + 1, phase, phaseIndex, weekInPhase: i + 1, pctAuto, repsAuto, setsAuto, rirAuto, fromRir });
    }
  });
  const total = Math.max(totalWeeks || 0, out.length);
  for (let w = out.length + 1; w <= total; w++) out.push({ week: w, phase: null, phaseIndex: -1, weekInPhase: 0, pctAuto: null, repsAuto: "", setsAuto: null, rirAuto: null, fromRir: false });
  return out.slice(0, total).map((w) => {
    const ov = weekOverrides[w.week] || {};
    const pctEdited = num(ov.pct) != null;
    const repsEdited = !!(ov.reps && String(ov.reps).trim());
    const setsEdited = intOrNull(ov.sets) != null;
    const rirEdited = rirOrNull(ov.rir) != null;
    const reps = repsEdited ? String(ov.reps).trim() : w.repsAuto;
    const rir = rirEdited ? rirOrNull(ov.rir) : w.rirAuto;
    // Si el % sale del RIR, cambiar las reps o el RIR de una semana lo recalcula
    const pctCalc = w.fromRir ? pctFromRir(reps, rir) : w.pctAuto;
    return {
      ...w,
      pct: pctEdited ? num(ov.pct) : pctCalc,
      reps,
      sets: setsEdited ? intOrNull(ov.sets) : w.setsAuto,
      rir,
      pctEdited, repsEdited, setsEdited, rirEdited,
    };
  });
}

// Semana ajustada al objetivo del día (ondulante diaria). Sin objetivo, la semana tal cual.
export function weekForDay(info, goalKey) {
  const g = dayGoal(goalKey);
  if (!info || !g) return info;
  return {
    ...info,
    pct: info.pct == null ? null : halfRound(info.pct + g.pct),
    reps: info.repsEdited ? info.reps : g.reps,
    sets: info.sets == null ? null : Math.max(1, info.sets + g.sets),
    dayGoal: g,
  };
}

// RM de una base: medido, o estimado con Epley si es peso × reps
export function rmOf(load) {
  const w = num(load?.weight_kg);
  if (w == null) return null;
  if (load.base_type !== "work") return w;
  const r = num(load.reps) || 1;
  return r <= 1 ? w : w * (1 + r / 30);
}

// Base que rige en una semana: la de from_week más alto que no pase esa semana.
// base_type "reps" = ejercicio sin peso: sigue las series y reps de la fase, pero no lleva kg.
// base_type "rir" = por esfuerzo, sin RM (el peso de partida es opcional).
// base_type "double" = progresión doble (peso inicial + rango de reps).
const noWeightNeeded = (t) => t === "reps" || t === "rir";
export function baseFor(loads, exerciseId, week) {
  return (loads || [])
    .filter((l) => String(l.exercise_id) === String(exerciseId) && (Number(l.from_week) || 1) <= week && (noWeightNeeded(l.base_type) || num(l.weight_kg) != null))
    .sort((a, b) => (Number(b.from_week) || 1) - (Number(a.from_week) || 1))[0] || null;
}

export const cellKey = (exerciseId, week) => `${exerciseId}:${week}`;

// Fecha (AAAA-MM-DD) del lunes de una semana del plan
export function weekDate(startDate, week) {
  if (!startDate) return null;
  const d = new Date(`${String(startDate).slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + (Math.max(1, Number(week) || 1) - 1) * 7);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Registro del alumno agrupado por día: history = [{ date: "AAAA-MM-DD", weight, reps, rir }]
function sessionsBetween(history, from, before) {
  const days = new Map();
  (history || []).forEach((r) => {
    const d = String(r.date || "").slice(0, 10);
    if (!d || (from && d < from) || (before && d >= before)) return;
    if (!days.has(d)) days.set(d, []);
    days.get(d).push(r);
  });
  return [...days.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

// Progresión doble: parte del peso inicial y, cada sesión en que el alumno llegó al tope del
// rango en todas las series pedidas (con ese peso o más), sube el incremento.
export function doubleProgression({ base, history, before = null, from = null, sets = null }) {
  let kg = num(base?.weight_kg);
  if (kg == null) return { kg: null, steps: 0 };
  const max = intOrNull(base.rep_max);
  const inc = num(base.increment) || Number(base.rounding) || 2.5;
  const need = Math.max(1, intOrNull(sets) || 1);
  let steps = 0;
  if (max) {
    sessionsBetween(history, from, before).forEach(([, rows]) => {
      const hits = rows.filter((r) => num(r.weight) != null && num(r.weight) >= kg - 0.01 && (num(r.reps) || 0) >= max).length;
      if (hits >= need) { kg += inc; steps += 1; }
    });
  }
  return { kg: Math.round(kg * 100) / 100, steps };
}

// RM estimado con la última sesión registrada antes de una fecha (peso × (reps + RIR), Epley).
// Si el alumno no anotó el RIR se supone que dejó el que se le pidió (fallbackRir).
export function lastE1rm(history, before = null, fallbackRir = 0) {
  const sessions = sessionsBetween(history, null, before);
  if (!sessions.length) return null;
  const rows = sessions[sessions.length - 1][1];
  let best = null;
  rows.forEach((r) => {
    const w = num(r.weight), reps = num(r.reps);
    if (w == null || w <= 0 || !reps) return;
    const rir = rirOrNull(r.rir) ?? (fallbackRir || 0);
    const e = w * (1 + (reps + rir) / 30);
    if (best == null || e > best) best = e;
  });
  return best;
}

// Peso de un ejercicio en una semana
// cells: { "exId:week": { value, reps, sets } }  (casillas editadas a mano)
// unit: unidad de quien lo ve. Los pesos van siempre en kg, pero el cálculo automático se
// redondea en esa unidad (2,5 kg o 5 lb) para que salgan números redondos de discos.
// Opcionales: goal = objetivo del día (ondulante diaria); history = { [exerciseId]: registro del alumno };
// startDate = inicio del plan; date = día que se calcula (alumno). Sin date se usa el lunes de la semana.
export function loadFor({ weeks, loads, cells = {}, exerciseId, week, unit = "kg", goal = null, history = null, startDate = null, date = null }) {
  const info = weekForDay(weeks[week - 1], goal);
  const base = baseFor(loads, exerciseId, week);
  const cell = cells[cellKey(exerciseId, week)];
  const type = base?.base_type || null;
  const round = (raw) => (raw == null ? null : unit === "lb" ? roundWeight(raw, base.rounding, "lb") : roundTo(raw, Number(base.rounding) || 2.5));
  const before = date || weekDate(startDate, week);
  const rows = history ? history[String(exerciseId)] || [] : [];
  let pct = info?.pct ?? null;
  let rm = null;
  let auto = null;
  let steps = 0;
  if (type === "double") {
    const d = doubleProgression({ base, history: rows, before, from: weekDate(startDate, base.from_week), sets: info?.sets });
    auto = d.kg;
    steps = d.steps;
    pct = null;
  } else if (type === "rir") {
    rm = lastE1rm(rows, before, info?.rir ?? 0);
    auto = rm != null && pct != null ? round((rm * pct) / 100) : num(base.weight_kg);
  } else if (type !== "reps") {
    rm = base ? rmOf(base) : null;
    auto = rm != null && pct != null ? round((rm * pct) / 100) : null;
  }
  const repsOnly = type === "reps";
  const manualKg = repsOnly ? null : num(cell?.value);
  const kg = manualKg != null ? manualKg : repsOnly ? null : auto;
  const repRange = type === "double" && intOrNull(base.rep_min) && intOrNull(base.rep_max) ? `${intOrNull(base.rep_min)}-${intOrNull(base.rep_max)}` : "";
  const applies = !!base || manualKg != null;
  const repsAuto = repRange || (applies ? info?.reps || "" : "");
  const reps = (cell?.reps && String(cell.reps).trim()) || repsAuto;
  const manualSets = intOrNull(cell?.sets);
  const sets = manualSets != null ? manualSets : applies ? info?.sets ?? null : null;
  return {
    kg,
    auto,
    pct: kg != null && rm ? Math.round((kg / rm) * 1000) / 10 : type === "double" ? null : pct,
    reps,
    manual: manualKg != null,
    repsManual: !!(cell?.reps && String(cell.reps).trim()),
    sets,
    setsAuto: applies ? info?.sets ?? null : null,
    setsManual: manualSets != null,
    rir: applies && type !== "double" ? info?.rir ?? null : null,
    rm,
    estimated: type === "work" || type === "rir",
    base,
    repsAuto,
    repsOnly,
    kind: type,
    repRange,
    steps,
    goal: info?.dayGoal || null,
  };
}

// Mapa para el alumno: { [exerciseId]: { value_type: "kg", value, reps, sets, rir, kind } } de la semana indicada
export function loadMapForWeek({ phases, totalWeeks, weekRows, loads, cellRows, week, unit = "kg", goal = null, history = null, startDate = null, date = null }) {
  const overrides = {};
  (weekRows || []).forEach((r) => { overrides[r.week_index] = { pct: r.pct, reps: r.reps, sets: r.sets, rir: r.rir }; });
  const weeks = planWeeks(phases, totalWeeks, overrides);
  const cells = {};
  (cellRows || []).forEach((c) => { cells[cellKey(c.exercise_id, c.week_index)] = { value: c.value, reps: c.reps, sets: c.sets }; });
  const ids = new Set([...(loads || []).map((l) => String(l.exercise_id)), ...(cellRows || []).filter((c) => c.week_index === week).map((c) => String(c.exercise_id))]);
  const map = {};
  ids.forEach((id) => {
    const r = loadFor({ weeks, loads, cells, exerciseId: id, week, unit, goal, history, startDate, date });
    if (r.kg != null || r.reps || r.sets || r.rir != null || r.kind === "rir") {
      const e = { value_type: "kg", value: r.kg, reps: r.reps || null, sets: r.sets || null };
      if (r.rir != null) e.rir = r.rir;
      if (r.kind === "double" || r.kind === "rir") e.kind = r.kind;
      if (r.repRange) e.repRange = r.repRange;
      map[id] = e;
    }
  });
  return map;
}
