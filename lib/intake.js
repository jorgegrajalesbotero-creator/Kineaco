// Ficha de ingreso: opciones compartidas entre la pantalla del alumno y el panel del coach.

export const INTAKE_GOALS = [
  { key: "bajar_grasa", label: "Bajar grasa" },
  { key: "ganar_musculo", label: "Ganar músculo" },
  { key: "fuerza", label: "Ganar fuerza" },
  { key: "salud", label: "Salud general" },
  { key: "rendimiento", label: "Rendimiento deportivo" },
];

export const INTAKE_EXPERIENCE = [
  { key: "nunca", label: "Nunca entrené" },
  { key: "menos_6m", label: "Menos de 6 meses" },
  { key: "6m_2a", label: "6 meses a 2 años" },
  { key: "mas_2a", label: "Más de 2 años" },
];

export function intakeLabel(list, key) {
  return list.find((o) => o.key === key)?.label || key || "—";
}

// Alerta para el coach: lesión actual o restricción médica (las lesiones pasadas no disparan la alerta)
export function intakeHasAlert(form) {
  return !!(form && (form.current_injury || form.medical_restriction));
}
