// Tipos de fase del plan (mesociclos ATR). Los cálculos de semanas y cargas están en lib/loadCalc.js.

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
