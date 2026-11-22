// Reloj del alumno: lógica pura (sin pantallas) para Descanso, Tabata (también intermitentes), AMRAP y Cronómetro.
// El tiempo se calcula siempre desde la hora real (Date.now), así no se atrasa si el celular
// pone la página en segundo plano.

// "intervals" (Intervalos / intermitentes) hacía lo mismo que Tabata: quedó un solo modo, "tabata".
// Los relojes viejos guardados como "intervals" se leen como Tabata (ver canonicalMode).
export const CLOCK_MODES = ["rest", "tabata", "amrap", "stopwatch"];

export function canonicalMode(mode) {
  return mode === "intervals" ? "tabata" : mode;
}

export const PREP_SECONDS = 10;

function intervalFields(maxTime) {
  return [
    { key: "prep", label: "Preparación", unit: "time", step: 1, min: 0, max: 300 },
    { key: "work", label: "Trabajo", unit: "time", step: 1, min: 1, max: maxTime },
    { key: "rest", label: "Descanso", unit: "time", step: 1, min: 0, max: maxTime },
    { key: "rounds", label: "Ciclos", unit: "count", step: 1, min: 1, max: 99 },
    { key: "sets", label: "Series", unit: "count", step: 1, min: 1, max: 20 },
    { key: "setRest", label: "Descanso entre series", unit: "time", step: 1, min: 0, max: 1800 },
    { key: "cooldown", label: "Enfriamiento (cool down)", unit: "time", step: 1, min: 0, max: 1800 },
  ];
}

// Valores por defecto y límites de cada campo (en segundos, salvo rondas y minutos).
// Los tiempos se pueden escribir exactos (7 s, 1:35...) y los botones − / + van de a 1 s
// hasta 1 minuto, de a 5 s hasta 5 minutos y de a 15 s después (ver stepFor).
export const CLOCK_FIELDS = {
  rest: [{ key: "seconds", label: "Descanso", unit: "time", step: 1, min: 1, max: 900 }],
  // Tabata / intermitentes: preparación → (trabajo + descanso) × ciclos → descanso entre series → … × series → enfriamiento
  tabata: intervalFields(1800),
  amrap: [{ key: "minutes", label: "Duración", unit: "minutes", step: 1, min: 1, max: 90 }],
  stopwatch: [],
};

export const CLOCK_DEFAULTS = {
  rest: { seconds: 90 },
  tabata: { prep: PREP_SECONDS, work: 20, rest: 10, rounds: 8, sets: 1, setRest: 60, cooldown: 0 },
  amrap: { minutes: 12 },
  stopwatch: {},
};

// Siguiente valor al tocar − (dir = -1) o + (dir = 1). En los tiempos el paso crece con el valor,
// así 7 → 8 s es un toque y 5:00 → 5:15 también.
export function stepFor(field, value, dir) {
  if (field.unit !== "time") return clampField(field, value + dir * field.step);
  const v = Number(value) || 0;
  const ref = dir > 0 ? v : v - 1; // al bajar, el paso es el del tramo de abajo (60 → 59, no 55)
  const step = ref < 60 ? 1 : ref < 300 ? 5 : 15;
  let next = v + dir * step;
  if (step > 1) next = dir > 0 ? Math.floor(next / step) * step : Math.ceil(next / step) * step;
  return clampField(field, next);
}

// Lee un tiempo escrito: "8" → 8 s, "1:30" → 90 s, "1.30" o "1,30" → 90 s, "90s" → 90 s, "2m" → 120 s.
// Devuelve null si no se entiende.
export function parseClockInput(text) {
  const t = String(text ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  let m = t.match(/^(\d{1,3})[:.,'](\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Math.min(59, Number(m[2]));
  m = t.match(/^(\d{1,3})m(?:in)?(?:(\d{1,2})s?)?$/);
  if (m) return Number(m[1]) * 60 + Math.min(59, Number(m[2] || 0));
  m = t.match(/^(\d{1,4})(?:s|seg)?$/);
  if (m) return Number(m[1]);
  return null;
}

// Campos que se muestran. Todos siempre a la vista (antes el descanso entre series aparecía
// solo después de poner 2 o más series, y parecía que no estaba).
// eslint-disable-next-line no-unused-vars
export function visibleFields(mode, cfg) {
  return CLOCK_FIELDS[canonicalMode(mode)] || [];
}

export function clampField(field, value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return field.min;
  return Math.min(field.max, Math.max(field.min, n));
}

// Une lo guardado con los valores por defecto y lo deja dentro de los límites
export function normalizeConfig(rawMode, cfg) {
  const mode = canonicalMode(rawMode);
  const base = { ...CLOCK_DEFAULTS[mode], ...(cfg || {}) };
  for (const f of CLOCK_FIELDS[mode] || []) base[f.key] = clampField(f, base[f.key]);
  return base;
}

// Lista de fases { type: "prep" | "work" | "rest" | "setrest" | "cooldown", dur (s), round, rounds, set, sets }
export function buildPhases(rawMode, cfg, extraSeconds = 0) {
  const mode = canonicalMode(rawMode);
  const c = normalizeConfig(mode, cfg);
  if (mode === "rest") return [{ type: "rest", dur: Math.max(1, c.seconds + extraSeconds), round: 1, rounds: 1 }];
  if (mode === "amrap") {
    return [
      { type: "prep", dur: PREP_SECONDS, round: 0, rounds: 1 },
      { type: "work", dur: c.minutes * 60, round: 1, rounds: 1 },
    ];
  }
  if (mode === "tabata") {
    const base = { rounds: c.rounds, sets: c.sets };
    const out = [];
    if (c.prep > 0) out.push({ ...base, type: "prep", dur: c.prep, round: 0, set: 1 });
    for (let s = 1; s <= c.sets; s++) {
      for (let r = 1; r <= c.rounds; r++) {
        out.push({ ...base, type: "work", dur: c.work, round: r, set: s });
        // Sin descanso después del último ciclo de la serie
        if (c.rest > 0 && r < c.rounds) out.push({ ...base, type: "rest", dur: c.rest, round: r, set: s });
      }
      if (s < c.sets && c.setRest > 0) out.push({ ...base, type: "setrest", dur: c.setRest, round: c.rounds, set: s });
    }
    if (c.cooldown > 0) out.push({ ...base, type: "cooldown", dur: c.cooldown, round: c.rounds, set: c.sets });
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
  if (!t || typeof t !== "object") return null;
  const mode = canonicalMode(t.mode);
  if (!CLOCK_MODES.includes(mode)) return null;
  return { ...normalizeConfig(mode, t), mode };
}

// Texto corto del reloj programado. `tr` traduce (en el panel del coach se pasa la función identidad).
export function timerLabel(t, tr = (x) => x) {
  const n = normalizeTimer(t);
  if (!n) return "";
  if (n.mode === "rest") return `${tr("Descanso")} ${formatClock(n.seconds)}`;
  if (n.mode === "amrap") return `AMRAP ${n.minutes} min`;
  if (n.mode === "stopwatch") return tr("Cronómetro");
  let text = `Tabata ${formatClock(n.work)} / ${formatClock(n.rest)} × ${n.rounds}`;
  if (n.sets > 1) text += ` × ${n.sets} ${tr("series")} (${tr("descanso")} ${formatClock(n.setRest)})`;
  if (n.cooldown > 0) text += ` + ${tr("enfriamiento")} ${formatClock(n.cooldown)}`;
  return text;
}

// ---- Qué ejercicio toca (Tabata programado en un bloque de la rutina) ----
// exercises = [{ name, detail }] en el orden del bloque.
// Tabata: cada ciclo de trabajo es un ejercicio, en orden, y vuelve a empezar al terminar la lista
// (y al empezar cada serie). En AMRAP no se marca ejercicio por ejercicio (el alumno se concentra en
// trabajar): solo se muestra la lista de la ronda. Devuelve { current, next } (ejercicio o null).
export function clockExercises(mode, phases, st, exercises) {
  const list = Array.isArray(exercises) ? exercises.filter((e) => e && e.name) : [];
  const n = list.length;
  if (!n || canonicalMode(mode) !== "tabata") return { current: null, next: null };
  const exAt = (ph) => list[(Math.max(1, ph.round) - 1) % n];
  if (!st) return { current: null, next: list[0] }; // sin iniciar
  if (st.done) return { current: null, next: null };
  const current = st.phase.type === "work" ? exAt(st.phase) : null;
  const upcoming = phases.slice(st.index + 1).find((p) => p.type === "work");
  return { current, next: upcoming ? exAt(upcoming) : null };
}

// ---- Cuenta por serie: cuántas veces va cada ejercicio y cuáles ya terminó ----
// Mismo reparto que clockExercises (un ejercicio por ciclo de trabajo), pero mirando TODA la
// serie en curso: por cada ejercicio dice cuántos ciclos lleva hechos y cuántos le tocan.
// La cuenta se reinicia en cada serie. Todo se deduce de las fases ya pasadas, así que
// funciona igual al recargar, al pausar o al saltar una fase (no se guarda nada).
// Devuelve null si no aplica (no es Tabata, o el bloque no trae ejercicios).
export function clockExerciseProgress(mode, phases, st, exercises) {
  const list = Array.isArray(exercises) ? exercises.filter((e) => e && e.name) : [];
  const n = list.length;
  if (!n || canonicalMode(mode) !== "tabata") return null;
  const lastSet = phases.length ? phases[phases.length - 1].set || 1 : 1;
  // Serie que se muestra: la del estado; sin iniciar, la primera; ya terminado, la última.
  // En el descanso entre series se ve la serie que acaba de completar (esa fase lleva su número).
  const set = !st ? 1 : st.done ? lastSet : st.phase.set || 1;
  const items = list.map((e) => ({ ...e, done: 0, total: 0, current: false, complete: false }));
  let done = 0;
  let total = 0;
  phases.forEach((p, i) => {
    if (p.type !== "work" || (p.set || 1) !== set) return;
    const it = items[(Math.max(1, p.round) - 1) % n];
    it.total += 1;
    total += 1;
    if (st && (st.done || i < st.index)) {
      it.done += 1;
      done += 1;
    }
    if (st && !st.done && i === st.index) it.current = true;
  });
  for (const it of items) it.complete = it.total > 0 && it.done >= it.total;
  return { set, sets: phases[0]?.sets || 1, items, done, total };
}

// ---- Textos de la tarjeta del reloj (pantalla de bloqueo y notificaciones) ----
// Se arman aparte, y a propósito SIN el tiempo que baja: el celular borra y recarga la
// carátula cada vez que cambian estos textos, así que si llevaran los segundos dentro, la
// pantalla de bloqueo parpadearía sin parar. El tiempo lo anima el propio celular con la
// barra de progreso (ver lib/clockMedia.js).
//
// Devuelve, además de los tres textos, los datos que necesita el dibujo de la carátula.
// Sin traductor, al menos se reemplazan los {p0} para que no salgan en pantalla
const sinTraducir = (text, params) => (params ? String(text).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? "") : text);

export function clockCardText({ mode, phases = [], st, exercises = [], rounds = 0, tr = sinTraducir }) {
  const m = canonicalMode(mode);
  const vueltas = tr("Rondas: {p0}", { p0: rounds });
  if (m === "stopwatch") return { title: tr("Cronómetro"), artist: "", album: "", phase: "work", cycle: 0, cycles: 0, set: 1, sets: 1, rounds };
  if (!st || st.done) {
    // Al terminar un AMRAP, lo que importa es cuántas rondas hizo
    return { title: tr("¡Terminado!"), artist: m === "amrap" ? vueltas : "", album: "", phase: "done", cycle: 0, cycles: 0, set: 1, sets: 1, rounds };
  }
  const p = st.phase;
  const fase = p.type === "prep" ? tr("Prepárese")
    : p.type === "work" ? (m === "amrap" ? "AMRAP" : tr("Trabajo"))
      : p.type === "setrest" ? tr("Descanso entre series")
        : p.type === "cooldown" ? tr("Enfriamiento") : tr("Descanso");

  const { current, next } = clockExercises(mode, phases, st, exercises);
  const cycles = p.rounds || 0;
  const cycle = p.type === "prep" ? 0 : p.round || 0;
  const sets = p.sets || 1;
  const set = p.set || 1;

  const linea2 = [fase];
  // En AMRAP las rondas son lo que el alumno va contando: van bien a la vista, en la
  // segunda línea, para poder confirmar desde afuera que la que acaba de sumar quedó.
  if (m === "amrap" && p.type !== "prep") linea2.push(vueltas);
  if (sets > 1) linea2.push(tr("Serie {p0} de {p1}", { p0: set, p1: sets }));

  const linea3 = [];
  // Con ejercicios, la tercera línea dice cuál sigue (el ciclo ya va en el anillo de la carátula)
  if (next) linea3.push(`${tr("Sigue")}: ${next.name}`);
  else if (m === "tabata" && cycle > 0) linea3.push(tr("Ciclo {p0} de {p1}", { p0: cycle, p1: cycles }));
  // El total va en minutos, no en segundos: en segundos cambiaría a cada rato y arrastraría
  // la carátula con él. Así cambia una vez por minuto.
  const minutos = Math.ceil((st.totalRemaining || 0) / 60);
  if (minutos > 0 && !next) linea3.push(tr("faltan {p0} min", { p0: minutos }));

  return {
    title: current ? current.name : fase,
    artist: linea2.join(" · "),
    album: linea3.join(" · "),
    phase: p.type,
    rounds,
    cycle,
    cycles,
    set,
    sets,
  };
}
