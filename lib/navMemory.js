// Recuerda dónde estaba la persona (sección, alumno abierto, panel) para que, si la página se
// recarga entera (cambiar entre vista de alumno y panel, el iPhone que cierra la app en segundo
// plano, abrir una notificación), vuelva al mismo lugar y no a "Alumnos" o a "Inicio".
// Solo se recuerda por un rato: si pasó mucho tiempo, se arranca normal.
export const NAV_MAX_AGE_MS = 30 * 60 * 1000;

const PREFIX = "kineaco:nav:";
const used = new Set(); // cada recuerdo se usa una sola vez por carga de página

// Lógica pura (con pruebas): el valor guardado sirve si es reciente
export function freshValue(raw, now = Date.now(), maxAge = NAV_MAX_AGE_MS) {
  if (!raw || typeof raw !== "object" || !("at" in raw)) return null;
  const at = Number(raw.at);
  if (!Number.isFinite(at) || at > now + 60 * 1000 || now - at > maxAge) return null;
  return raw.v ?? null;
}

export function rememberNav(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, at: Date.now() }));
  } catch { }
}

// Devuelve lo recordado solo la primera vez que se pide en esta carga de la página
export function recallNav(key) {
  if (used.has(key)) return null;
  used.add(key);
  try { return freshValue(JSON.parse(localStorage.getItem(PREFIX + key) || "null")); } catch { return null; }
}
