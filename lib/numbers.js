// Campos numéricos que aceptan punto o coma como decimal (ej. 35,5 o 35.5).
// Se guardan siempre con punto para que la base de datos los entienda.

export function cleanDecimal(value, decimals = 2) {
  let s = String(value ?? "").replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const i = s.indexOf(".");
  if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "").slice(0, decimals);
  return s;
}

export const cleanInt = (value) => String(value ?? "").replace(/[^0-9]/g, "");

export function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
