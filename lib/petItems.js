// Ropa, accesorios y fondos del camaleón, y cómo se desbloquean.
// OJO: los números tienen que ser los mismos que en la función kin_pet_unlocks de Supabase
// (la base es la que decide de verdad qué se puede poner; esto es para mostrar el avance).
//
// Cómo se avanza (métricas de kin_pet_stats):
//   trainings   = días entrenados en total
//   streak_best = mejor racha de semanas seguidas cumpliendo la meta de su plan
//   checkins    = check-ins respondidos
//   records     = récords personales (superó su mejor peso en un ejercicio)
//   challenges  = retos grupales logrados en los que aportó

export const PET_SLOTS = [
  { key: "bg", label: "Fondo" },
  { key: "head", label: "Cabeza" },
  { key: "eyes", label: "Ojos" },
  { key: "body", label: "Ropa" },
  { key: "neck", label: "Cuello" },
  { key: "waist", label: "Cinturón" },
  { key: "back", label: "Espalda" },
  { key: "feet", label: "Pies" },
  { key: "aura", label: "Aura" },
];

export const METRIC_LABEL = {
  trainings: { one: "entrenamiento", many: "entrenamientos" },
  streak_best: { one: "semana seguida cumpliendo", many: "semanas seguidas cumpliendo" },
  checkins: { one: "check-in", many: "check-ins" },
  records: { one: "récord", many: "récords" },
  challenges: { one: "reto grupal logrado", many: "retos grupales logrados" },
};

// special = uno de los 5 más difíciles
export const PET_ITEMS = [
  { key: "selva", slot: "bg", name: "Selva", metric: null, need: 0 },
  { key: "banda", slot: "head", name: "Banda de sudor", metric: "trainings", need: 1 },
  { key: "gafas", slot: "eyes", name: "Gafas de sol", metric: "trainings", need: 3 },
  { key: "gorra", slot: "head", name: "Gorra", metric: "trainings", need: 6 },
  { key: "tenis", slot: "feet", name: "Tenis blancos", metric: "trainings", need: 10 },
  { key: "montana", slot: "bg", name: "Montaña", metric: "trainings", need: 10 },
  { key: "camiseta", slot: "body", name: "Camiseta", metric: "trainings", need: 20 },
  { key: "tenis_dorados", slot: "feet", name: "Tenis dorados", metric: "trainings", need: 40 },
  { key: "playa", slot: "bg", name: "Playa", metric: "streak_best", need: 2 },
  { key: "gimnasio", slot: "bg", name: "Gimnasio", metric: "streak_best", need: 6 },
  { key: "sombrero", slot: "head", name: "Sombrero", metric: "streak_best", need: 8 },
  { key: "capa", slot: "back", name: "Capa", metric: "streak_best", need: 12 },
  { key: "corona", slot: "head", name: "Corona", metric: "streak_best", need: 26 },
  { key: "lentes", slot: "eyes", name: "Lentes", metric: "checkins", need: 10 },
  { key: "medalla", slot: "neck", name: "Medalla", metric: "records", need: 1 },
  { key: "atardecer", slot: "bg", name: "Atardecer", metric: "records", need: 5 },
  { key: "camiseta_numero", slot: "body", name: "Camiseta con número", metric: "challenges", need: 1 },
  // Nuevos (nov. 2026)
  { key: "toalla", slot: "neck", name: "Toalla al cuello", metric: "trainings", need: 5 },
  { key: "medias", slot: "feet", name: "Medias altas", metric: "trainings", need: 12 },
  { key: "gafas_natacion", slot: "eyes", name: "Gafas de natación", metric: "trainings", need: 15 },
  { key: "pista", slot: "bg", name: "Pista atlética", metric: "trainings", need: 15 },
  { key: "mochila", slot: "back", name: "Mochila deportiva", metric: "trainings", need: 25 },
  { key: "buzo", slot: "body", name: "Buzo con capucha", metric: "trainings", need: 30 },
  { key: "cuernos", slot: "head", name: "Cuernos vikingos", metric: "trainings", need: 60 },
  { key: "gorro_lana", slot: "head", name: "Gorro de lana", metric: "streak_best", need: 4 },
  { key: "ciudad", slot: "bg", name: "Ciudad de noche", metric: "streak_best", need: 10 },
  { key: "silbato", slot: "neck", name: "Silbato", metric: "checkins", need: 20 },
  { key: "audifonos", slot: "head", name: "Audífonos", metric: "checkins", need: 25 },
  { key: "esqueleto", slot: "body", name: "Esqueleto deportivo", metric: "records", need: 8 },
  { key: "mancuerna", slot: "back", name: "Mancuerna", metric: "records", need: 15 },
  { key: "antifaz", slot: "eyes", name: "Antifaz de superhéroe", metric: "challenges", need: 3 },
  // De temporada: solo en diciembre (con 1 entrenamiento)
  { key: "gorro_navidad", slot: "head", name: "Gorro navideño", metric: "trainings", need: 1, season: 12 },
  { key: "reno", slot: "head", name: "Cuernos de reno", metric: "trainings", need: 1, season: 12 },
  { key: "nieve", slot: "bg", name: "Nieve", metric: "trainings", need: 1, season: 12 },
  // Los 5 especiales
  { key: "aura", slot: "aura", name: "Aura de fuego", metric: "streak_best", need: 20, special: true },
  { key: "cinturon", slot: "waist", name: "Cinturón de campeón", metric: "records", need: 30, special: true },
  { key: "galaxia", slot: "bg", name: "Galaxia", metric: "challenges", need: 10, special: true },
  { key: "armadura", slot: "body", name: "Armadura de campeón", metric: "trainings", need: 150, special: true },
  { key: "alas", slot: "back", name: "Alas doradas", metric: "streak_best", need: 52, special: true },
];

export const itemByKey = (key) => PET_ITEMS.find((i) => i.key === key) || null;

// Mes en Colombia (1 a 12): las prendas de temporada solo valen en su mes
export const colombiaMonth = (now = new Date()) => Number(now.toLocaleDateString("en-CA", { timeZone: "America/Bogota", month: "numeric" }));
export const inSeason = (item, now = new Date()) => !item.season || item.season === colombiaMonth(now);

// Lo que se ve con las estadísticas (para mostrar el avance; la base confirma)
export function computeUnlocks(stats, now = new Date()) {
  const s = stats || {};
  return PET_ITEMS.filter((i) => inSeason(i, now) && (!i.metric || (Number(s[i.metric]) || 0) >= i.need)).map((i) => i.key);
}

// "6 de 10 entrenamientos"
export function progressText(item, stats, now = new Date()) {
  if (!item.metric) return "De entrada";
  if (!inSeason(item, now)) return "Solo en diciembre";
  const have = Math.min(Number(stats?.[item.metric]) || 0, item.need);
  const l = METRIC_LABEL[item.metric];
  return `${have} de ${item.need} ${item.need === 1 ? l.one : l.many}`;
}

export function needText(item) {
  if (!item.metric) return "De entrada";
  if (item.season) return "Solo en diciembre";
  const l = METRIC_LABEL[item.metric];
  return `${item.need} ${item.need === 1 ? l.one : l.many}`;
}

// Solo quedan las cosas que sí se tienen (por si algo dejó de estar desbloqueado)
export function cleanOutfit(outfit, unlocked) {
  const ok = new Set(unlocked || []);
  const out = {};
  Object.entries(outfit || {}).forEach(([slot, key]) => {
    const it = itemByKey(key);
    if (it && it.slot === slot && ok.has(key)) out[slot] = key;
  });
  return out;
}

// Nivel de la rama (0 a 3): más fácil que antes, pensado para 2 a 4 entrenamientos por semana
export function branchLevel({ trainings = 0, streak_best = 0 } = {}) {
  if (trainings >= 80 || streak_best >= 16) return 3;
  if (trainings >= 30 || streak_best >= 6) return 2;
  if (trainings >= 10 || streak_best >= 2) return 1;
  return 0;
}
