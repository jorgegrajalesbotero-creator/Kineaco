// Tipos de bloque de una rutina (compartido entre el panel del coach y la pantalla del alumno).
export const BLOCK_TYPES = [
  { key: "aproximacion", label: "Aproximación" },
  { key: "calentamiento", label: "Calentamiento" },
  { key: "principal", label: "Trabajo principal" },
  { key: "intermitentes", label: "Intermitentes" },
  { key: "remate", label: "Remate" },
  { key: "estiramiento", label: "Estiramiento y retroalimentación" },
];

export function blockTypeLabel(key) {
  return BLOCK_TYPES.find((t) => t.key === key)?.label || key;
}

// Los pesos de la progresión ATR y los pesos personalizados solo se aplican
// en rutinas sin bloques y en los bloques de trabajo principal.
export function blockUsesProgression(blockType) {
  return !blockType || blockType === "principal";
}
