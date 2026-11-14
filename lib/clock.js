// Reloj del alumno: lógica pura (sin pantallas) para Descanso, Tabata, Intervalos, AMRAP y Cronómetro.
// El tiempo se calcula siempre desde la hora real (Date.now), así no se atrasa si el celular
// pone la página en segundo plano.

export const CLOCK_MODES = ["rest", "tabata", "intervals", "amrap", "stopwatch"];

export const PREP_SECONDS = 10;

// Valores por defecto y límites de cada campo (en segundos, salvo rondas y minutos)
export const CLOCK_FIELDS = {
  rest: [{ key: "seconds", label: "Descanso", unit: "time", step: 15, min: 15, max: 900 }],
  tabata: [
    { key: "work", label: "Trabajo", unit: "time", step: 5, min: 5, max: 600 },
    { key: "rest", label: "Descanso", unit: "time", step: 5, min: 0, max: 600 },
    { key: "rounds", label: "Rondas", unit: "count", step: 1, min: 1, max: 99 },
  ],
  intervals: [
    { key: "work", label: "Trabajo", unit: "time", step: 5, min: 5, max: 1800 },
    { key: "rest", label: "Descanso", unit: "time", step: 5, min: 0, max: 1800 },
    { key: "rounds", label: "Rondas", unit: "count", step: 1, min: 1, max: 99 },
  ],
  amrap: [{ key: "minutes", label: "Duración", unit: "minutes", step: 1, min: 1, max: 90 }],
  stopwatch: [],
};

export const CLOCK_DEFAULTS = {
  rest: { seconds: 90 },
  tabata: { work: 20, rest: 10, rounds: 8 },
  intervals: { work: 40, rest: 20, rounds: 10 },
  amrap: { minutes: 12 },
  stopwatch: {},
};

export function clampField(field, value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return field.min;
  return Math.min(field.max, Math.max(field.min, n));
}

// Une lo guardado con los valores por defecto y lo deja dentro de los límites
export function normalizeConfig(mode, cfg) {
  const base = { ...CLOCK_DEFAULTS[mode], ...(cfg || {}) };
  for (const f of CLOCK_FIELDS[mode] || []) base[f.key] = clampField(f, base[f.key]);
  return base;
}

// Lista de fases { type: "prep" | "work" | "rest", dur (s), round, rounds }
export function buildPhases(mode, cfg, extraSeconds = 0) {
  const c = normalizeConfig(mode, cfg);
  if (mode === "rest") return [{ type: "rest", dur: Math.max(1, c.seconds + extraSeconds), round: 1, rounds: 1 }];
  if (mode === "amrap") {
    return [
      { type: "prep", dur: PREP_SECONDS, round: 0, rounds: 1 },
      { type: "work", dur: c.minutes * 60, round: 1, rounds: 1 },
    ];
  }
  if (mode === "tabata" || mode === "intervals") {
    const out = [{ type: "prep", dur: PREP_SECONDS, round: 0, rounds: c.rounds }];
    for (let r = 1; r <= c.rounds; r++) {
      out.push({ type: "work", dur: c.work, round: r, rounds: c.rounds });
      // Sin descanso después de la última ronda
      if (c.rest > 0 && r < c.rounds) out.push({ type: "rest", dur: c.rest, round: r, rounds: c.rounds });
    }
    return out;
  }
  return [];
}

export function totalSeconds(phases) {
  return phases.reduce((t, p) => t + p.dur, 0);
}

// En qué fase va el reloj después de `elapsedMs` milisegundos
export function stateAt(phases, elapsedMs) {
  const elapsed = Math.max(0, elapsedMs) / 1000;
  let acc = 0;
  for (let i = 0; i < phases.length; i++) {
    const end = acc + phases[i].dur;
    if (elapsed < end) {
      return { index: i, phase: phases[i], remaining: Math.ceil(end - elapsed - 1e-9), totalRemaining: Math.ceil(totalSeconds(phases) - elapsed - 1e-9), done: false };
    }
    acc = end;
  }
  return { index: phases.length, phase: null, remaining: 0, totalRemaining: 0, done: true };
}

// 75 → "1:15"; 3725 → "1:02:05"
export function formatClock(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

// Cronómetro con décimas: 65.4 s → "1:05.4"
export function formatStopwatch(ms) {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  return `${formatClock(tenths / 10)}.${tenths % 10}`;
}

// ---- Reloj programado por el coach (se guarda como { mode, ...valores }) ----

// Deja un reloj guardado en un formato seguro, o null si no sirve
export function normalizeTimer(t) {
  if (!t || typeof t !== "object" || !CLOCK_MODES.includes(t.mode)) return null;
  return { mode: t.mode, ...normalizeConfig(t.mode, t) };
}

// Texto corto del reloj programado. `tr` traduce (en el panel del coach se pasa la función identidad).
export function timerLabel(t, tr = (x) => x) {
  const n = normalizeTimer(t);
  if (!n) return "";
  if (n.mode === "rest") return `${tr("Descanso")} ${formatClock(n.seconds)}`;
  if (n.mode === "amrap") return `AMRAP ${n.minutes} min`;
  if (n.mode === "stopwatch") return tr("Cronómetro");
  const name = n.mode === "tabata" ? "Tabata" : tr("Intervalos");
  return `${name} ${formatClock(n.work)} / ${formatClock(n.rest)} × ${n.rounds}`;
}
