import { Flame, CalendarCheck, Footprints, Dumbbell, Award, Camera, Utensils } from "lucide-react";
import { fetchAllRows } from "./fetchAll";

// Insignias y logros: se calculan siempre a partir de los datos que ya existen
// (ejercicios completados, pesos, fotos de progreso y comidas). No hay tabla propia.

export const BADGE_GROUPS = [
  { key: "constancia", label: "Constancia" },
  { key: "volumen", label: "Volumen" },
  { key: "fuerza", label: "Fuerza" },
  { key: "habitos", label: "Hábitos" },
];

const BADGE_DEFS = [
  { key: "racha-3", group: "constancia", title: "3 días seguidos", icon: Flame, metric: "bestStreak", target: 3, unit: "días" },
  { key: "racha-7", group: "constancia", title: "Semana perfecta", icon: Flame, metric: "bestStreak", target: 7, unit: "días" },
  { key: "dias-10", group: "constancia", title: "10 días entrenados", icon: CalendarCheck, metric: "daysTrained", target: 10, unit: "días" },
  { key: "dias-30", group: "constancia", title: "30 días entrenados", icon: CalendarCheck, metric: "daysTrained", target: 30, unit: "días" },
  { key: "dias-100", group: "constancia", title: "100 días entrenados", icon: CalendarCheck, metric: "daysTrained", target: 100, unit: "días" },
  { key: "ej-1", group: "volumen", title: "Primer paso", icon: Footprints, metric: "exercisesDone", target: 1, unit: "ejercicios" },
  { key: "ej-100", group: "volumen", title: "100 ejercicios", icon: Dumbbell, metric: "exercisesDone", target: 100, unit: "ejercicios" },
  { key: "ej-500", group: "volumen", title: "500 ejercicios", icon: Dumbbell, metric: "exercisesDone", target: 500, unit: "ejercicios" },
  { key: "pr-1", group: "fuerza", title: "Primer récord", icon: Award, metric: "personalRecords", target: 1, unit: "récords" },
  { key: "pr-5", group: "fuerza", title: "5 récords", icon: Award, metric: "personalRecords", target: 5, unit: "récords" },
  { key: "pr-15", group: "fuerza", title: "15 récords", icon: Award, metric: "personalRecords", target: 15, unit: "récords" },
  { key: "fotos-1", group: "habitos", title: "Primeras fotos", icon: Camera, metric: "photoSets", target: 1, unit: "registros" },
  { key: "comidas-7", group: "habitos", title: "7 días de comidas", icon: Utensils, metric: "mealDays", target: 7, unit: "días" },
];

function localDayKey(dateLike) {
  const d = new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function loadBadgeData(supabase, userId) {
  const [progressRes, countRes, photosRes, mealsRes] = await Promise.all([
    fetchAllRows(() =>
      supabase
        .from("progress")
        .select("completed_at, exercise_id, weight_kg")
        .eq("user_id", userId)
        .order("completed_at", { ascending: true })
    ),
    supabase.from("progress").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("progress_photo_sets").select("id", { count: "exact", head: true }).eq("user_id", userId),
    fetchAllRows(() => supabase.from("meal_logs").select("log_date").eq("user_id", userId).order("log_date")),
  ]);

  const rows = progressRes;

  // Días entrenados y mejor racha (días de calendario seguidos con algún ejercicio)
  const dayKeys = [...new Set(rows.map((r) => localDayKey(r.completed_at)))].sort();
  let bestStreak = 0;
  let run = 0;
  let prev = null;
  dayKeys.forEach((key) => {
    const current = new Date(key + "T12:00:00");
    if (prev && Math.round((current - prev) / 86400000) === 1) run += 1;
    else run = 1;
    if (run > bestStreak) bestStreak = run;
    prev = current;
  });

  // Récords personales: cada vez que supera su peso máximo anterior en un ejercicio
  const maxByExercise = {};
  let personalRecords = 0;
  rows.forEach((r) => {
    if (r.weight_kg == null || r.exercise_id == null) return;
    const kg = Number(r.weight_kg);
    const id = String(r.exercise_id);
    if (maxByExercise[id] == null) {
      maxByExercise[id] = kg;
    } else if (kg > maxByExercise[id]) {
      personalRecords += 1;
      maxByExercise[id] = kg;
    }
  });

  return {
    bestStreak,
    daysTrained: dayKeys.length,
    exercisesDone: countRes.count ?? rows.length,
    personalRecords,
    photoSets: photosRes.count ?? 0,
    mealDays: new Set(mealsRes.map((m) => m.log_date)).size,
  };
}

export function computeBadges(stats) {
  return BADGE_DEFS.map((b) => {
    const current = stats?.[b.metric] ?? 0;
    return { ...b, current: Math.min(current, b.target), unlocked: current >= b.target };
  });
}
