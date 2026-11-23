// Tipos de fase del plan. Los cálculos de semanas y cargas están en lib/loadCalc.js.
// ATR (bloques): acumulación, transformación, realización, descarga.
// Lineal, lineal inversa y ondulante semanal: hipertrofia, fuerza, fuerza máxima, resistencia.
// Ondulante diaria: "progresión" (sube el % semana a semana; cada día cambia el objetivo).

export const PHASE_TYPES = [
  { key: "acumulacion", label: "Acumulación", color: "#5CC8FF" },
  { key: "transformacion", label: "Transformación", color: "#FFB547" },
  { key: "realizacion", label: "Realización", color: "#FF6B4A" },
  { key: "descarga", label: "Descarga", color: "#B48CFF" },
  { key: "resistencia", label: "Resistencia", color: "#5FD3B0" },
  { key: "hipertrofia", label: "Hipertrofia", color: "#7AA2FF" },
  { key: "fuerza", label: "Fuerza", color: "#FFD166" },
  { key: "maxima", label: "Fuerza máxima", color: "#FF8A5C" },
  { key: "progresion", label: "Progresión", color: "#9BE15D" },
  { key: "otro", label: "Otro", color: "#8A9690" },
];

export function phaseType(key) {
  return PHASE_TYPES.find((t) => t.key === key) || PHASE_TYPES[PHASE_TYPES.length - 1];
}

export function phaseDisplayName(phase) {
  const custom = (phase?.name || "").trim();
  return custom || phaseType(phase?.phase_type).label;
}
