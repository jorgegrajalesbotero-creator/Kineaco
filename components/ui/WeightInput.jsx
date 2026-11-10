"use client";

import { useState } from "react";
import { cleanDecimal } from "@/lib/numbers";
import { UNITS, kgToText, textToKg, useWeightUnit } from "@/lib/weightUnits";

const sameKg = (a, b) => String(a ?? "") === String(b ?? "");
const UNIT_NAMES = { kg: "kilogramos", lb: "libras" };

// Selector kg | lb (para encabezados). t: traductor opcional (pantallas del alumno).
export function UnitToggle({ className = "", t = (s) => s }) {
  const [unit, setUnit] = useWeightUnit();
  return (
    <span role="group" aria-label={t("Unidad de peso")} className={`inline-flex rounded-full bg-field p-0.5 normal-case tracking-normal ${className}`}>
      {UNITS.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => setUnit(u)}
          aria-pressed={unit === u}
          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${unit === u ? "bg-accent text-app" : "text-soft hover:text-ink"}`}
        >
          {u}
        </button>
      ))}
    </span>
  );
}

// Campo de peso que se escribe en kg o en lb, pero siempre entrega kilogramos.
// valueKg / onChangeKg trabajan en kg (texto); lo que ve la persona está en su unidad.
// toggle: muestra dentro del campo el botón para cambiar de unidad.
export function WeightInput({ valueKg, onChangeKg, placeholderKg, placeholder, toggle = true, className = "", wrapperClassName = "", ...props }) {
  const [unit, setUnit] = useWeightUnit();
  const [state, setState] = useState({ text: kgToText(valueKg, unit), kg: valueKg, unit });

  // Si el valor cambia desde afuera (se limpia el formulario) o cambia la unidad, se vuelve a escribir el texto
  if (state.unit !== unit || !sameKg(state.kg, valueKg)) {
    setState({ text: kgToText(valueKg, unit), kg: valueKg, unit });
  }

  const change = (e) => {
    const text = cleanDecimal(e.target.value);
    const kg = textToKg(text, unit);
    setState({ text, kg, unit });
    onChangeKg(kg);
  };

  const other = unit === "kg" ? "lb" : "kg";
  const hint = placeholderKg != null && placeholderKg !== "" ? kgToText(placeholderKg, unit) : placeholder;

  return (
    <span className={`relative block min-w-0 ${wrapperClassName}`}>
      <input
        type="text"
        inputMode="decimal"
        value={state.text}
        onChange={change}
        placeholder={hint}
        className={`${className} ${toggle ? "pr-11" : ""}`}
        {...props}
      />
      {toggle && (
        <button
          type="button"
          onClick={() => setUnit(other)}
          title={`Cambiar a ${UNIT_NAMES[other]}`}
          aria-label={`Unidad: ${UNIT_NAMES[unit]}. Cambiar a ${UNIT_NAMES[other]}`}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-app/50 px-1.5 py-1 text-[11px] font-semibold leading-none text-accent hover:bg-accent hover:text-app transition-colors"
        >
          {unit}
        </button>
      )}
    </span>
  );
}
