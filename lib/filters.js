// ---------- Filtros por categorías (chips) ----------
// Funciones puras (sin React) para que se puedan probar. Las usan las vistas de
// rutinas, ejercicios, alumnos y usuarios junto con components/ui/FilterBar.jsx.
//
// Una "categoría" (facet) se define así:
//   {
//     id: "grupo",                      // clave interna
//     label: "Grupo",                   // texto que se muestra
//     getValues: (item) => valor | [valores],  // valores crudos del ítem
//     split: true,                      // opcional: separa "Glúteo, cuádriceps"
//     emptyLabel: "Sin grupo",          // opcional: opción para ítems sin valor
//     options: [{ value, label }],      // opcional: categorías fijas (orden fijo)
//     labelOf: (rawValue) => "texto",   // opcional: etiqueta a partir del valor
//   }
// Dentro de una categoría las opciones marcadas se suman (O); entre categorías
// se combinan (Y).

import { normalizeText } from "@/lib/search";

export const EMPTY = "__vacio__";

// Clave normalizada: sin tildes, en minúscula y sin espacios sobrantes.
// Así "Musculación " y "musculacion" caen en la misma opción.
export function facetKey(value) {
  return normalizeText(value).trim().replace(/\s+/g, " ");
}

// "Glúteo, cuádriceps" -> ["Glúteo", "cuádriceps"]
export function splitList(value) {
  return String(value ?? "")
    .split(/[,;/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Texto legible: sin espacios sobrantes y con la primera letra en mayúscula.
export function prettyLabel(value) {
  const s = String(value ?? "").trim().replace(/\s+/g, " ");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function rawValues(facet, item) {
  const raw = facet.getValues(item);
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
    .flatMap((v) => (facet.split ? splitList(v) : [String(v)]));
}

// Claves de un ítem para una categoría (sin repetidos).
export function itemKeys(facet, item) {
  const keys = [...new Set(rawValues(facet, item).map(facetKey).filter(Boolean))];
  if (keys.length === 0 && facet.emptyLabel) return [EMPTY];
  return keys;
}

// Opciones de una categoría con su conteo.
//  - allItems: todos los ítems (define qué opciones existen y su etiqueta).
//  - countItems: ítems sobre los que se cuenta (los que quedan con los demás filtros).
export function buildFacetOptions(allItems, countItems, facet, selectedValues = []) {
  const counts = new Map();
  countItems.forEach((item) => {
    itemKeys(facet, item).forEach((k) => counts.set(k, (counts.get(k) || 0) + 1));
  });

  if (facet.options) {
    const existing = new Set(allItems.flatMap((item) => itemKeys(facet, item)));
    return facet.options
      .map((o) => ({ value: facetKey(o.value), label: o.label }))
      .filter((o) => existing.has(o.value) || selectedValues.includes(o.value))
      .map((o) => ({ ...o, count: counts.get(o.value) || 0 }));
  }

  // Opciones dinámicas: etiqueta = forma de escribirlo más frecuente.
  const spellings = new Map(); // clave -> Map(texto -> veces)
  const totals = new Map();
  allItems.forEach((item) => {
    const raws = rawValues(facet, item);
    const seen = new Set();
    raws.forEach((raw) => {
      const k = facetKey(raw);
      if (!k || seen.has(k)) return;
      seen.add(k);
      const label = facet.labelOf ? facet.labelOf(raw) : prettyLabel(raw);
      if (!spellings.has(k)) spellings.set(k, new Map());
      const m = spellings.get(k);
      m.set(label, (m.get(label) || 0) + 1);
      totals.set(k, (totals.get(k) || 0) + 1);
    });
    if (raws.length === 0 && facet.emptyLabel) totals.set(EMPTY, (totals.get(EMPTY) || 0) + 1);
  });

  const labelFor = (k) => {
    if (k === EMPTY) return facet.emptyLabel;
    const m = spellings.get(k);
    if (!m) return k;
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  };

  const keys = new Set([...totals.keys(), ...selectedValues]);
  return [...keys]
    .map((k) => ({ value: k, label: labelFor(k), count: counts.get(k) || 0, total: totals.get(k) || 0 }))
    .sort((a, b) => {
      if (a.value === EMPTY) return 1;
      if (b.value === EMPTY) return -1;
      return b.total - a.total || a.label.localeCompare(b.label);
    })
    .map((o) => ({ value: o.value, label: o.label, count: o.count }));
}

function passesFacets(item, facets, selected, exceptId) {
  return facets.every((f) => {
    if (f.id === exceptId) return true;
    const sel = selected[f.id];
    if (!sel || sel.length === 0) return true;
    return itemKeys(f, item).some((k) => sel.includes(k));
  });
}

// Aplica búsqueda + categorías y calcula las opciones de cada categoría.
//  - matches(item): resultado de la búsqueda de texto (true si coincide).
//  - Los conteos de una categoría tienen en cuenta la búsqueda y las DEMÁS
//    categorías, así cada chip dice cuántos resultados quedarían.
export function filterItems({ items, facets, selected = {}, matches = () => true }) {
  const searched = items.filter(matches);
  const result = searched.filter((item) => passesFacets(item, facets, selected, null));
  const facetOptions = facets.map((f) => ({
    id: f.id,
    label: f.label,
    options: buildFacetOptions(
      items,
      searched.filter((item) => passesFacets(item, facets, selected, f.id)),
      f,
      selected[f.id] || []
    ),
  }));
  return { result, facetOptions };
}

// Ordena según el criterio elegido. sorts: [{ id, label, compare(a, b) }].
// Si el id no existe se usa el primero. No modifica el arreglo original.
export function sortItems(items, sorts, sortId) {
  const s = sorts.find((x) => x.id === sortId) || sorts[0];
  return s ? [...items].sort(s.compare) : [...items];
}

// Cantidad de opciones marcadas en total (para el botón "Filtros (n)").
export function activeFilterCount(selected = {}) {
  return Object.values(selected).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
}

// ---------- Clasificadores de tiempo (alumnos y usuarios) ----------
const DAY = 86400000;

export const ACCESS_OPTIONS = [
  { value: "vence7", label: "Vence en 7 días o menos" },
  { value: "vence30", label: "Vence en 8 a 30 días" },
  { value: "mas30", label: "Más de 30 días" },
  { value: "vencido", label: "Vencido" },
  { value: "sin", label: "Sin acceso" },
];

// Tiempo de acceso que le queda a un alumno.
export function accessBucket(accessUntil, now = new Date()) {
  if (!accessUntil) return "sin";
  const until = new Date(accessUntil);
  if (Number.isNaN(until.getTime())) return "sin";
  if (until <= now) return "vencido";
  const days = Math.ceil((until - now) / DAY);
  if (days <= 7) return "vence7";
  if (days <= 30) return "vence30";
  return "mas30";
}

export const SENIORITY_OPTIONS = [
  { value: "m1", label: "Menos de 1 mes" },
  { value: "m3", label: "1 a 3 meses" },
  { value: "m6", label: "3 a 6 meses" },
  { value: "mas6", label: "Más de 6 meses" },
];

// Antigüedad: cuánto tiempo lleva registrado.
export function seniorityBucket(createdAt, now = new Date()) {
  if (!createdAt) return null;
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return null;
  const days = Math.floor((now - start) / DAY);
  if (days < 30) return "m1";
  if (days < 90) return "m3";
  if (days < 180) return "m6";
  return "mas6";
}

// Texto corto de antigüedad: "5 días", "3 semanas", "4 meses", "1 año".
export function durationSince(createdAt, now = new Date()) {
  if (!createdAt) return "";
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return "";
  const days = Math.max(0, Math.floor((now - start) / DAY));
  if (days < 14) return days === 1 ? "1 día" : `${days} días`;
  if (days < 60) return `${Math.floor(days / 7)} semanas`;
  if (days < 365) return `${Math.floor(days / 30)} meses`;
  const years = Math.floor(days / 365);
  return years === 1 ? "1 año" : `${years} años`;
}
