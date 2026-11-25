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
  { key: "eyes", label: "Gafas" },
  { key: "body", label: "Ropa" },
  { key: "neck", label: "Medalla" },
  { key: "waist", label: "Cinturón" },
  { key: "back", label: "Espalda" },
  { key: "feet", label: "Tenis" },
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
  // Los 5 especiales
  { key: "aura", slot: "aura", name: "Aura de fuego", metric: "streak_best", need: 20, special: true },
  { key: "cinturon", slot: "waist", name: "Cinturón de campeón", metric: "records", need: 30, special: true },
  { key: "galaxia", slot: "bg", name: "Galaxia", metric: "challenges", need: 10, special: true },
  { key: "armadura", slot: "body", name: "Armadura de campeón", metric: "trainings", need: 150, special: true },
  { key: "alas", slot: "back", name: "Alas doradas", metric: "streak_best", need: 52, special: true },
];

export const itemByKey = (key) => PET_ITEMS.find((i) => i.key === key) || null;

// Lo que se ve con las estadísticas (para mostrar el avance; la base confirma)
export function computeUnlocks(stats) {
  const s = stats || {};
  return PET_ITEMS.filter((i) => !i.metric || (Number(s[i.metric]) || 0) >= i.need).map((i) => i.key);
}

// "6 de 10 entrenamientos"
export function progressText(item, stats) {
  if (!item.metric) return "De entrada";
  const have = Math.min(Number(stats?.[item.metric]) || 0, item.need);
  const l = METRIC_LABEL[item.metric];
  return `${have} de ${item.need} ${item.need === 1 ? l.one : l.many}`;
}

export function needText(item) {
  if (!item.metric) return "De entrada";
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
