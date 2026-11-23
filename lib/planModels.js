// Tipos de planeación. Todos usan el mismo motor del ATR (fases → % / reps / series / RIR por semana,
// cargas calculadas, casillas a mano, cambios de ejercicios, repetir / quitar semana, plantillas, PDF).
// Cada tipo trae sus fases de partida (se pueden cambiar todas) y la forma de progresar
// que se ofrece primero en "Cargas y ejercicios".
import { PHASE_DEFAULTS } from "@/lib/loadCalc";

export const PLAN_MODELS = [
  {
    key: "atr",
    label: "Bloques (ATR)",
    short: "Acumulación → transformación → realización",
    help: "Bloques cortos con un objetivo cada uno. Para alumnos con una meta y una fecha.",
    mode: "kg",
  },
  {
    key: "lineal",
    label: "Lineal",
    short: "Cada semana sube el peso y bajan las reps",
    help: "Hipertrofia → fuerza → fuerza máxima, de forma gradual. Ideal para principiantes o quien vuelve a entrenar.",
    mode: "kg",
  },
  {
    key: "lineal_inversa",
    label: "Lineal inversa",
    short: "Empieza pesado y termina con más reps",
    help: "Fuerza máxima → fuerza → hipertrofia → resistencia. Para resistencia muscular o final de temporada.",
    mode: "kg",
  },
  {
    key: "doble",
    label: "Progresión doble",
    short: "Sube reps dentro de un rango; al llegar al tope, sube el peso",
    help: "Cada ejercicio tiene peso inicial y rango de reps. Cuando el alumno hace el tope del rango en todas las series, la app le sube el peso sola.",
    mode: "double",
  },
  {
    key: "ondulante_semanal",
    label: "Ondulante semanal",
    short: "Cada semana cambia el objetivo",
    help: "Fuerza, hipertrofia y resistencia se alternan semana a semana; cada vuelta sube un poco el %.",
    mode: "kg",
  },
  {
    key: "ondulante_diaria",
    label: "Ondulante diaria",
    short: "Cada día de la semana tiene su objetivo",
    help: "Por ejemplo lunes fuerza, miércoles hipertrofia y viernes resistencia. El % base sube semana a semana y cada día lo ajusta.",
    mode: "kg",
  },
  {
    key: "rir",
    label: "Autorregulada (RPE / RIR)",
    short: "Se fija el esfuerzo: cuántas reps le quedan en reserva",
    help: "Cada semana tiene reps y RIR. Con RM, el % sale solo de las reps + RIR; sin RM, el peso se sugiere con lo que el alumno registró la última vez.",
    mode: "rir",
  },
];

export const planModel = (key) => PLAN_MODELS.find((m) => m.key === key) || PLAN_MODELS[0];

const s = (v) => (v == null ? "" : String(v));
// Fase en el formato del editor (todo texto)
export function phaseOf(type, weeks, over = {}) {
  const d = PHASE_DEFAULTS[type] || PHASE_DEFAULTS.otro;
  return {
    phase_type: type,
    name: over.name || "",
    weeks: String(weeks),
    pct_start: s(over.pct_start !== undefined ? over.pct_start : d.pct_start),
    pct_end: s(over.pct_end !== undefined ? over.pct_end : d.pct_end),
    reps_start: s(over.reps_start !== undefined ? over.reps_start : d.reps_start),
    reps_end: s(over.reps_end !== undefined ? over.reps_end : d.reps_end),
    sets_start: s(over.sets_start !== undefined ? over.sets_start : d.sets_start),
    sets_end: s(over.sets_end !== undefined ? over.sets_end : d.sets_end),
    rir_start: s(over.rir_start),
    rir_end: s(over.rir_end),
  };
}

// Fases de partida de cada tipo. cycles = vueltas del ondulante semanal.
export function modelPhases(key, { cycles = 4 } = {}) {
  switch (key) {
    case "lineal":
      return [phaseOf("hipertrofia", 4), phaseOf("fuerza", 4), phaseOf("maxima", 3), phaseOf("descarga", 1)];
    case "lineal_inversa":
      return [phaseOf("maxima", 3), phaseOf("fuerza", 4), phaseOf("hipertrofia", 4), phaseOf("resistencia", 3)];
    case "doble":
      return [phaseOf("otro", 8, { name: "Progresión doble", sets_start: 3, sets_end: 3 })];
    case "ondulante_semanal": {
      const out = [];
      for (let c = 0; c < cycles; c++) {
        const up = c * 2.5;
        out.push(phaseOf("fuerza", 1, { pct_start: 80 + up, pct_end: 80 + up, reps_start: "5", reps_end: "5", sets_start: 4, sets_end: 4 }));
        out.push(phaseOf("hipertrofia", 1, { pct_start: 70 + up, pct_end: 70 + up, reps_start: "10", reps_end: "10", sets_start: 4, sets_end: 4 }));
        out.push(phaseOf("resistencia", 1, { pct_start: 60 + up, pct_end: 60 + up, reps_start: "15", reps_end: "15", sets_start: 3, sets_end: 3 }));
      }
      return out;
    }
    case "ondulante_diaria":
      return [phaseOf("progresion", 8), phaseOf("descarga", 1)];
    case "rir":
      return [
        phaseOf("acumulacion", 4, { pct_start: null, pct_end: null, reps_start: "10", reps_end: "8", rir_start: 3, rir_end: 2 }),
        phaseOf("transformacion", 3, { pct_start: null, pct_end: null, reps_start: "6", reps_end: "5", rir_start: 2, rir_end: 1 }),
        phaseOf("realizacion", 2, { pct_start: null, pct_end: null, reps_start: "3", reps_end: "3", rir_start: 1, rir_end: 0 }),
      ];
    case "atr":
    default:
      return [phaseOf("acumulacion", 4), phaseOf("transformacion", 3), phaseOf("realizacion", 2)];
  }
}

// Ondulante diaria: objetivo de partida para los días con rutina (en orden: fuerza, hipertrofia, resistencia...)
const GOAL_ORDER = ["fuerza", "hipertrofia", "resistencia", "potencia"];
export function defaultDayGoals(trainingDays) {
  const out = {};
  (trainingDays || []).forEach((day, i) => { out[day] = GOAL_ORDER[i % GOAL_ORDER.length]; });
  return out;
}
