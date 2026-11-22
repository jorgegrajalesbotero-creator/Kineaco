"use client";

// Reloj del alumno COMPARTIDO por toda la app (uno solo a la vez).
// Vive fuera de las pantallas: si el alumno cierra el reloj grande, va a ver un ejercicio,
// cambia de pestaña o sale de la app, el reloj sigue corriendo y se ve en la píldora de arriba.
// Se guarda en el celular (localStorage) para seguir donde iba aunque se cierre la app.
// El tiempo siempre se calcula con la hora real (Date.now), así nunca se atrasa.
import { useSyncExternalStore } from "react";
import { CLOCK_MODES, buildPhases, canonicalMode, normalizeConfig, normalizeTimer, totalSeconds } from "@/lib/clock";
import { beepPause, beepStart, getAudio, startAlarm } from "@/lib/alarm";

const KEY = "workout_clock_v2";
const OLD_KEY = "workout_clock_v1"; // configuración guardada por la versión anterior
const STALE_MS = 30 * 60 * 1000; // un reloj que terminó hace más de 30 min ya no se recupera

const listeners = new Set();
let state = null;
let alarmStop = null;

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

// Ejercicios que acompañan al reloj (los del bloque donde el coach lo programó): [{ name, detail }]
function cleanExercises(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => e && typeof e.name === "string" && e.name.trim())
    .slice(0, 40)
    .map((e) => ({
      name: e.name.trim().slice(0, 120),
      detail: typeof e.detail === "string" ? e.detail.slice(0, 120) : "",
      // Con esto el reloj puede dar el bloque por hecho al terminar (ver lib/clockProgress.js)
      exerciseId: e.exerciseId ?? null,
      itemKey: e.itemKey ?? null,
      routineId: e.routineId ?? null,
      setsCount: Number(e.setsCount) || 0,
      byItem: !!e.byItem,
      targetWeight: e.targetWeight ?? null,
      targetReps: typeof e.targetReps === "string" ? e.targetReps.slice(0, 40) : null,
    }));
}

function freshState() {
  const old = readJSON(OLD_KEY) || {};
  const oldMode = canonicalMode(old.mode);
  return {
    open: false,
    mode: CLOCK_MODES.includes(oldMode) ? oldMode : "tabata",
    configs: Object.fromEntries(CLOCK_MODES.map((m) => [m, normalizeConfig(m, old.configs?.[m])])),
    run: null, // { startedAt, pausedAt (o null), pausedTotal, extra (s, solo descanso) }
    rounds: 0, // AMRAP
    laps: [], // cronómetro (ms acumulados)
    preset: null, // reloj programado por el coach
    source: "clock", // "clock" = reloj del alumno · "rest" = descanso entre series
    exercises: [], // ejercicios del bloque (Tabata / AMRAP): el reloj dice cuál toca y cuál sigue
    dayLabel: null, // día de la rutina de donde salió (hace falta para marcar lo hecho)
    fromRoutine: false, // abierto desde la rutina: al iniciar Tabata/AMRAP se achica para ver los ejercicios
    compact: false, // la píldora grande se puede achicar a la normal
    ringing: false,
  };
}

function load() {
  if (typeof window === "undefined") return freshState();
  const base = freshState();
  const saved = readJSON(KEY);
  if (!saved) return base;
  const savedMode = canonicalMode(saved.mode);
  // Configuración vieja de "Intervalos": si no había Tabata guardado, se usa la de Intervalos
  const savedConfigs = { ...(saved.configs || {}) };
  if (saved.mode === "intervals" && savedConfigs.intervals) savedConfigs.tabata = savedConfigs.intervals;
  const s = {
    ...base,
    mode: CLOCK_MODES.includes(savedMode) ? savedMode : base.mode,
    configs: Object.fromEntries(CLOCK_MODES.map((m) => [m, normalizeConfig(m, savedConfigs[m] ?? base.configs[m])])),
    run: saved.run && Number.isFinite(saved.run.startedAt) ? saved.run : null,
    rounds: Number(saved.rounds) || 0,
    laps: Array.isArray(saved.laps) ? saved.laps : [],
    preset: normalizeTimer(saved.preset),
    source: saved.source === "rest" ? "rest" : "clock",
    exercises: cleanExercises(saved.exercises),
    dayLabel: typeof saved.dayLabel === "string" ? saved.dayLabel : null,
    fromRoutine: !!saved.fromRoutine,
    compact: !!saved.compact,
  };
  // Un reloj que terminó hace rato no se recupera
  const end = endAt(s);
  if (s.run && end !== null && Date.now() - end > STALE_MS) s.run = null;
  if (s.run && s.mode === "stopwatch" && Date.now() - s.run.startedAt > 6 * 3600 * 1000) s.run = null;
  return s;
}

function save() {
  try {
    const { mode, configs, run, rounds, laps, preset, source, exercises, dayLabel, fromRoutine, compact } = state;
    localStorage.setItem(KEY, JSON.stringify({ mode, configs, run, rounds, laps, preset, source, exercises, dayLabel, fromRoutine, compact }));
  } catch {
    // sin almacenamiento: el reloj igual funciona mientras la app esté abierta
  }
}

function get() {
  if (state === null) state = load();
  return state;
}

function set(patch) {
  const prev = get();
  state = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
  save();
  listeners.forEach((l) => l());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const serverSnapshot = freshState();

export function useClock() {
  return useSyncExternalStore(subscribe, get, () => serverSnapshot);
}

export const getClock = get;
export const subscribeClock = subscribe;

// ---------- Cálculos ----------
export function clockPhases(s) {
  return buildPhases(s.mode, s.configs[s.mode], s.run?.extra || 0);
}

// Milisegundos transcurridos (sin contar pausas)
export function elapsedMs(s, now = Date.now()) {
  if (!s.run) return 0;
  return (s.run.pausedAt ?? now) - s.run.startedAt - s.run.pausedTotal;
}

// Hora (ms) en que termina el reloj si sigue corriendo; null si no tiene fin, está en pausa o no corre
export function endAt(s) {
  if (!s.run || s.run.pausedAt || s.mode === "stopwatch") return null;
  return s.run.startedAt + s.run.pausedTotal + totalSeconds(clockPhases(s)) * 1000;
}

export const isRunning = (s) => !!s.run && !s.run.pausedAt;

// ---------- Alarma final (suena hasta que la apaguen) ----------
export function ringAlarm() {
  alarmStop?.();
  alarmStop = startAlarm();
  set({ ringing: true });
}

export function stopAlarm() {
  alarmStop?.();
  alarmStop = null;
  const s = get();
  // Si el reloj grande está cerrado, al apagar la alarma la píldora desaparece.
  // Si está abierto, queda en 0:00 marcado como "ya avisado" (para que no vuelva a sonar al recargar).
  set(s.open ? { ringing: false, run: s.run ? { ...s.run, acked: true } : null } : { ringing: false, run: null, rounds: 0, laps: [] });
}

// ---------- Acciones ----------
const newRun = () => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, startedAt: Date.now(), pausedAt: null, pausedTotal: 0, extra: 0 });

// Abrir el reloj grande. Si ya hay un reloj corriendo, se muestra ese (no se reinicia).
// exercises = ejercicios del bloque donde está programado (para decir cuál toca y cuál sigue).
// fromRoutine = se abrió desde la rutina: al iniciar Tabata/AMRAP el reloj se achica para ver los ejercicios.
export function openClock({ initialMode, preset, exercises, dayLabel = null, fromRoutine = false } = {}) {
  getAudio(); // iPhone exige activar el sonido con un toque
  const s = get();
  if (s.run) return set({ open: true });
  const programmed = normalizeTimer(preset);
  if (programmed) {
    return set((p) => ({
      open: true,
      preset: programmed,
      source: "clock",
      mode: programmed.mode,
      configs: { ...p.configs, [programmed.mode]: normalizeConfig(programmed.mode, programmed) },
      exercises: cleanExercises(exercises),
      dayLabel,
      fromRoutine,
    }));
  }
  const wanted = canonicalMode(initialMode);
  set((p) => ({ open: true, preset: null, source: "clock", mode: CLOCK_MODES.includes(wanted) ? wanted : p.mode, exercises: cleanExercises(exercises), dayLabel, fromRoutine }));
}

// Cerrar el reloj grande: si está corriendo sigue en la píldora
export function minimizeClock() {
  set({ open: false });
}

export function setClockMode(raw) {
  const m = canonicalMode(raw);
  if (!CLOCK_MODES.includes(m)) return;
  stopRinging();
  set({ mode: m, run: null, rounds: 0, laps: [] });
}

export function setClockField(field, value) {
  set((p) => ({ configs: { ...p.configs, [p.mode]: normalizeConfig(p.mode, { ...p.configs[p.mode], [field.key]: value }) } }));
}

// Tabata y AMRAP abiertos desde la rutina: al iniciar, el reloj se achica a la píldora grande
// (translúcida) para que el alumno vea los ejercicios mientras corre el tiempo.
export function startClock() {
  getAudio();
  beepStart(); // suena aquí mismo, dentro del toque: es lo que destraba el sonido en iPhone
  stopRinging();
  set((p) => ({
    run: newRun(),
    rounds: 0,
    laps: [],
    compact: false,
    open: p.open && !(p.fromRoutine && (p.mode === "tabata" || p.mode === "amrap")),
  }));
}

export const setIslandCompact = (compact) => set({ compact: !!compact });

export function pauseClock(silent = false) {
  const p0 = get();
  if (p0.run && !p0.run.pausedAt && !silent) beepPause();
  set((p) => (p.run && !p.run.pausedAt ? { run: { ...p.run, pausedAt: Date.now() } } : {}));
}

export function resumeClock() {
  getAudio();
  beepStart();
  set((p) => (p.run && p.run.pausedAt ? { run: { ...p.run, pausedTotal: p.run.pausedTotal + (Date.now() - p.run.pausedAt), pausedAt: null } } : {}));
}

export function resetClock() {
  stopRinging();
  set({ run: null, rounds: 0, laps: [] });
}

// Pasar a la siguiente fase (corre el inicio hacia atrás lo que falta de la fase actual)
export function skipPhase(index) {
  set((p) => {
    if (!p.run) return {};
    const phases = clockPhases(p);
    const ref = p.run.pausedAt ?? Date.now();
    const endMs = phases.slice(0, index + 1).reduce((t, ph) => t + ph.dur, 0) * 1000;
    return { run: { ...p.run, startedAt: ref - p.run.pausedTotal - endMs } };
  });
}

export function addRestSeconds(sec) {
  set((p) => (p.run ? { run: { ...p.run, extra: p.run.extra + sec } } : {}));
}

export function backToProgrammed() {
  const s = get();
  if (!s.preset) return;
  resetClock();
  set((p) => ({ mode: p.preset.mode, configs: { ...p.configs, [p.preset.mode]: normalizeConfig(p.preset.mode, p.preset) } }));
}

export const addRound = () => set((p) => ({ rounds: p.rounds + 1 }));
export const removeRound = () => set((p) => ({ rounds: Math.max(0, p.rounds - 1) }));
export const addLap = (ms) => set((p) => ({ laps: [...p.laps, ms] }));

// Descanso entre series: arranca ya y queda en la píldora (no abre el reloj grande)
export function startRest(seconds) {
  getAudio();
  beepStart();
  stopRinging();
  set((p) => ({
    open: false,
    source: "rest",
    preset: null,
    mode: "rest",
    configs: { ...p.configs, rest: normalizeConfig("rest", { seconds }) },
    run: newRun(),
    rounds: 0,
    laps: [],
    exercises: [],
    fromRoutine: false,
  }));
}

// Termina un descanso entre series si es lo que está corriendo (por ejemplo al finalizar el entrenamiento)
export function stopRest() {
  if (get().source === "rest") resetClock();
}

function stopRinging() {
  if (alarmStop) {
    alarmStop();
    alarmStop = null;
  }
  if (get().ringing) set({ ringing: false });
}
