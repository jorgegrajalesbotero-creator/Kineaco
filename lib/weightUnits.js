// Unidad del peso de los ejercicios: kilogramos o libras.
// La base de datos SIEMPRE guarda kilogramos (así los cálculos de cargas, récords e
// historial no cambian). La unidad solo afecta cómo se escribe y se muestra el peso,
// y se recuerda en ESTE navegador.
import { useSyncExternalStore } from "react";

export const KG_PER_LB = 0.45359237;
export const UNITS = ["kg", "lb"];
const STORAGE_KEY = "weightUnit";
const EVENT = "weightunitchange";

const round = (x, decimals) => {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
};

const parse = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// Kilogramos → número en la unidad elegida (2 decimales como máximo)
export function fromKg(kg, unit) {
  const n = parse(kg);
  if (n === null) return null;
  return unit === "lb" ? round(n / KG_PER_LB, 2) : round(n, 3);
}

// Número en la unidad elegida → kilogramos. Se guardan 3 decimales para que
// un peso escrito en libras (ej. 45 lb) vuelva a mostrarse exacto.
export function toKg(value, unit) {
  const n = parse(value);
  if (n === null) return null;
  return round(unit === "lb" ? n * KG_PER_LB : n, 3);
}

// Texto para un campo: "20.412" kg → "45" si la unidad es lb
export function kgToText(kg, unit) {
  const n = fromKg(kg, unit);
  return n === null ? "" : String(n);
}

// Lo escrito en un campo → kilogramos como texto ("" si está vacío o no es un número)
export function textToKg(text, unit) {
  const n = toKg(text, unit);
  return n === null ? "" : String(n);
}

// "45 lb", "20 kg" ("" si no hay peso)
export function formatWeight(kg, unit) {
  const n = fromKg(kg, unit);
  return n === null ? "" : `${n} ${unit}`;
}

function readUnit() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "lb" ? "lb" : "kg";
  } catch {
    return "kg";
  }
}

export function setWeightUnit(unit) {
  try {
    localStorage.setItem(STORAGE_KEY, unit === "lb" ? "lb" : "kg");
  } catch { }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// [unidad, cambiarUnidad]. Todos los campos de la pantalla cambian a la vez.
export function useWeightUnit() {
  const unit = useSyncExternalStore(subscribe, readUnit, () => "kg");
  return [unit, setWeightUnit];
}
