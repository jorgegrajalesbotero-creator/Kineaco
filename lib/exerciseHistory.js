import { fetchAllRows } from "./fetchAll";
import { localDateString } from "./dates";

// Progreso por ejercicio: une el historial cargado a mano por el coach
// (tabla exercise_history, sirve para alumnos que ya entrenaban antes de la app)
// con lo que el alumno registra en la app (progress_sets y progress).
// El historial SOLO cuenta para los gráficos: las insignias siguen usando progress.

export const PRECISIONS = [
  { key: "day", label: "Fecha exacta" },
  { key: "month", label: "Mes y año" },
  { key: "year", label: "Solo el año" },
];

const round1 = (n) => Math.round(n * 10) / 10;
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

export function exerciseKeyOf(exerciseId, name) {
  return exerciseId != null ? String(exerciseId) : `name:${String(name || "").trim().toLowerCase()}`;
}

function parseLocal(dateStr) {
  return new Date(String(dateStr).slice(0, 10) + "T12:00:00");
}

// Trae todo el progreso por ejercicio de un alumno, ya unificado.
// Cada registro: { uid, source: "history" | "app", id, exerciseKey, exerciseId, exerciseName,
//                  date, dateStr, precision, weight, reps, sets, note }
export async function loadExerciseEntries(supabase, userId) {
  const [historyRes, setRows, progressRows] = await Promise.all([
    supabase.from("exercise_history").select("*").eq("user_id", userId).order("performed_on", { ascending: true }),
    fetchAllRows(() =>
      supabase
        .from("progress_sets")
        .select("exercise_id, weight_kg, reps, completed_at")
        .eq("user_id", userId)
        .order("completed_at", { ascending: true })
    ),
    fetchAllRows(() =>
      supabase
        .from("progress")
        .select("exercise_id, exercise_name, weight_kg, completed_at")
        .eq("user_id", userId)
        .not("weight_kg", "is", null)
        .order("completed_at", { ascending: true })
    ),
  ]);
  // Si la tabla del historial todavía no existe, se sigue mostrando lo de la app
  const historyRows = historyRes.error ? [] : historyRes.data || [];

  // Nombres de los ejercicios
  const ids = new Set();
  historyRows.forEach((r) => r.exercise_id != null && ids.add(r.exercise_id));
  setRows.forEach((r) => r.exercise_id != null && ids.add(r.exercise_id));
  progressRows.forEach((r) => r.exercise_id != null && ids.add(r.exercise_id));
  const names = {};
  const idList = [...ids];
  for (let i = 0; i < idList.length; i += 200) {
    const { data } = await supabase.from("exercises").select("id, name").in("id", idList.slice(i, i + 200));
    (data || []).forEach((e) => (names[String(e.id)] = e.name));
  }
  progressRows.forEach((r) => {
    if (r.exercise_id != null && !names[String(r.exercise_id)] && r.exercise_name) names[String(r.exercise_id)] = r.exercise_name;
  });

  const entries = [];

  historyRows.forEach((r) => {
    const name = (r.exercise_id != null && names[String(r.exercise_id)]) || r.exercise_name || "Ejercicio";
    entries.push({
      uid: `h-${r.id}`,
      source: "history",
      id: r.id,
      exerciseKey: r.exercise_id != null ? String(r.exercise_id) : exerciseKeyOf(null, r.exercise_name),
      exerciseId: r.exercise_id,
      exerciseName: name,
      date: parseLocal(r.performed_on),
      dateStr: String(r.performed_on).slice(0, 10),
      precision: r.date_precision || "day",
      weight: num(r.weight_kg),
      reps: num(r.reps),
      sets: num(r.sets),
      note: r.note || "",
      raw: r,
    });
  });

  // Series registradas en la app: un registro por ejercicio y día
  // (peso = el mejor del día, reps = las de esa serie, series = cuántas hizo)
  const appDays = {};
  setRows.forEach((s) => {
    if (s.exercise_id == null) return;
    const dateStr = localDateString(new Date(s.completed_at));
    const key = `${s.exercise_id}|${dateStr}`;
    const g = (appDays[key] = appDays[key] || { exerciseId: s.exercise_id, dateStr, sets: 0, weight: null, reps: null });
    g.sets += 1;
    const w = num(s.weight_kg);
    const r = num(s.reps);
    if (w != null && (g.weight == null || w > g.weight || (w === g.weight && (r ?? 0) > (g.reps ?? 0)))) {
      g.weight = w;
      g.reps = r;
    } else if (g.weight == null && w == null && r != null && r > (g.reps ?? 0)) {
      g.reps = r;
    }
  });
  // Ejercicios marcados con peso antes de que existiera el registro por serie
  progressRows.forEach((p) => {
    if (p.exercise_id == null) return;
    const dateStr = localDateString(new Date(p.completed_at));
    const key = `${p.exercise_id}|${dateStr}`;
    const w = num(p.weight_kg);
    if (!appDays[key]) appDays[key] = { exerciseId: p.exercise_id, dateStr, sets: null, weight: w, reps: null };
    else if (appDays[key].weight == null || (w != null && w > appDays[key].weight)) appDays[key].weight = w;
  });

  Object.entries(appDays).forEach(([key, g]) => {
    if (g.weight == null && g.reps == null) return;
    entries.push({
      uid: `a-${key}`,
      source: "app",
      id: null,
      exerciseKey: String(g.exerciseId),
      exerciseId: g.exerciseId,
      exerciseName: names[String(g.exerciseId)] || "Ejercicio",
      date: parseLocal(g.dateStr),
      dateStr: g.dateStr,
      precision: "day",
      weight: g.weight,
      reps: g.reps,
      sets: g.sets || null,
      note: "",
    });
  });

  entries.sort((a, b) => a.date - b.date || (a.source === "history" ? -1 : 1));
  return entries;
}

// Lista de ejercicios con datos, el de registro más reciente primero
export function exerciseOptionsFrom(entries) {
  const map = {};
  entries.forEach((e) => {
    const o = (map[e.exerciseKey] = map[e.exerciseKey] || { key: e.exerciseKey, exerciseId: e.exerciseId, name: e.exerciseName, count: 0, last: e.date, hasHistory: false });
    o.count += 1;
    if (e.date > o.last) o.last = e.date;
    if (e.source === "history") o.hasHistory = true;
  });
  return Object.values(map).sort((a, b) => b.last - a.last);
}

// Etiqueta de fecha según la precisión
export function formatEntryDate(date, precision, locale = "es-CO") {
  if (precision === "year") return String(date.getFullYear());
  if (precision === "month") return date.toLocaleDateString(locale, { month: "short", year: "numeric" }).replace(".", "");
  return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
}

// Gana el registro más pesado; con el mismo peso, el de más reps; después más series
function better(a, b) {
  if (!b) return a;
  if ((a.weight ?? -1) !== (b.weight ?? -1)) return (a.weight ?? -1) > (b.weight ?? -1) ? a : b;
  if ((a.reps ?? -1) !== (b.reps ?? -1)) return (a.reps ?? -1) > (b.reps ?? -1) ? a : b;
  return (a.sets ?? -1) >= (b.sets ?? -1) ? a : b;
}

// Puntos para el gráfico. mode "day" = un punto por día (coach); "month" = el mejor de cada mes (alumno).
export function buildPoints(entries, mode = "day") {
  const groups = {};
  const order = [];
  entries.forEach((e) => {
    let key;
    let precision = e.precision;
    if (e.precision === "year") key = `y${e.date.getFullYear()}`;
    else if (mode === "month" || e.precision === "month") {
      key = `m${e.date.getFullYear()}-${e.date.getMonth()}`;
      precision = "month";
    } else key = `d${e.dateStr}`;
    if (!groups[key]) {
      groups[key] = { key, precision, best: null, entries: [] };
      order.push(key);
    }
    groups[key].best = better(e, groups[key].best);
    groups[key].entries.push(e);
  });
  return order
    .map((k) => {
      const g = groups[k];
      const date = g.precision === "year" ? new Date(g.best.date.getFullYear(), 0, 1, 12) : g.precision === "month" ? new Date(g.best.date.getFullYear(), g.best.date.getMonth(), 1, 12) : g.best.date;
      return { key: k, date, precision: g.precision, weight: g.best.weight, reps: g.best.reps, sets: g.best.sets, count: g.entries.length, sources: [...new Set(g.entries.map((e) => e.source))] };
    })
    .sort((a, b) => a.date - b.date);
}

// Escalera de récords: récord de peso (sube el máximo) o récord de reps (mismo peso máximo, más reps)
export function markRecords(points) {
  let maxW = null;
  let repsAtMax = null;
  let prCount = 0;
  const out = points.map((p, i) => {
    let kind = "normal";
    if (p.weight != null) {
      if (maxW == null) {
        maxW = p.weight;
        repsAtMax = p.reps;
        kind = "start";
      } else if (p.weight > maxW) {
        maxW = p.weight;
        repsAtMax = p.reps;
        kind = "pr";
        prCount += 1;
      } else if (p.weight === maxW && p.reps != null && (repsAtMax == null || p.reps > repsAtMax)) {
        repsAtMax = p.reps;
        kind = "reps";
        prCount += 1;
      }
    }
    return { ...p, kind, maxSoFar: maxW, index: i };
  });
  return { points: out, prCount, maxWeight: maxW };
}

// Siguiente meta sugerida: +1 kg en pesos livianos, +2,5 kg desde 10 kg
export function nextGoal(maxWeight) {
  if (maxWeight == null) return null;
  return round1(maxWeight + (maxWeight < 10 ? 1 : 2.5));
}

export function volumeOf(p) {
  if (p?.weight == null || p?.reps == null) return null;
  return round1(p.weight * p.reps * (p.sets || 1));
}

// Antes vs. ahora: primer y último registro con dato para cada medida
export function firstVsLast(points) {
  const pick = (getter) => {
    const withVal = points.filter((p) => getter(p) != null);
    if (withVal.length === 0) return null;
    return { from: getter(withVal[0]), to: getter(withVal[withVal.length - 1]), fromDate: withVal[0], toDate: withVal[withVal.length - 1] };
  };
  return {
    weight: pick((p) => p.weight),
    reps: pick((p) => p.reps),
    sets: pick((p) => p.sets),
    volume: pick((p) => volumeOf(p)),
  };
}

// Tiempo entre dos fechas en palabras ("3 años y 7 meses")
export function spanText(from, to, t = (s, p) => (p ? s.replace(/\{(\w+)\}/g, (_, k) => p[k]) : s)) {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (months < 1) {
    const days = Math.max(0, Math.round((to - from) / 86400000));
    return days === 1 ? t("1 día") : t("{p0} días", { p0: days });
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  const yText = y === 0 ? "" : y === 1 ? t("1 año") : t("{p0} años", { p0: y });
  const mText = m === 0 ? "" : m === 1 ? t("1 mes") : t("{p0} meses", { p0: m });
  if (yText && mText) return t("{p0} y {p1}", { p0: yText, p1: mText });
  return yText || mText;
}
