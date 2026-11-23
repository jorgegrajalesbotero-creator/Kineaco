// Comunidad: los alumnos de un mismo coach (o gimnasio) que decidieron entrar.
// Se ve: foto en miniatura, nombre, la mascota con su ánimo de hoy, el ejercicio que destacó hoy (sin peso),
// entrenamientos, racha y récords del mes (sin número). Nunca: pesos, medidas, fotos de progreso ni molestias.
// Todo lo de otros alumnos llega por funciones de la base (community_feed, community_challenges_for_me).
import { localDateString } from "@/lib/dates";
import { signedAvatarUrls } from "@/lib/avatars";

export const REACTIONS = [
  { key: "fuerza", emoji: "💪", label: "Fuerza" },
  { key: "fuego", emoji: "🔥", label: "Fuego" },
  { key: "aplauso", emoji: "👏", label: "Aplauso" },
];

// Logros de la mascota: su rama cambia con la constancia
export const PET_LEVELS = [
  { level: 0, name: "Rama", need: "Al empezar" },
  { level: 1, name: "Rama con hojas", need: "20 entrenamientos o 4 semanas seguidas" },
  { level: 2, name: "Rama en flor", need: "60 entrenamientos o 12 semanas seguidas" },
  { level: 3, name: "Rama dorada", need: "120 entrenamientos o 26 semanas seguidas" },
];

export const HIGHLIGHT_LABEL = { record: "Récord personal", destacado: "Destacó", elegido: "Su ejercicio del día" };

export async function loadMembership(supabase, userId) {
  const { data, error } = await supabase.from("community_members").select("*").eq("user_id", userId).maybeSingle();
  if (error) return { missing: true, member: null };
  return { missing: false, member: data };
}

export async function setMembership(supabase, userId, visible) {
  return supabase.from("community_members").upsert({ user_id: userId, visible, updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select("*").single();
}

// Ejercicio destacado de hoy elegido por el alumno (null = el que propone la app)
export async function setHighlight(supabase, userId, exerciseId) {
  return supabase
    .from("community_members")
    .upsert({ user_id: userId, highlight_exercise_id: exerciseId || null, highlight_date: exerciseId ? localDateString() : null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
}

export async function loadFeed(supabase) {
  const { data, error } = await supabase.rpc("community_feed");
  if (error) return { missing: true, members: [] };
  // Las fotos están en un bucket privado: se guarda la ruta y aquí se firma para poder mostrarla
  const list = data || [];
  const urls = await signedAvatarUrls(list.map((m) => m.avatar_url));
  return { missing: false, members: list.map((m, i) => ({ ...m, avatar_url: urls[i] || null })) };
}

export async function loadChallenges(supabase) {
  const { data, error } = await supabase.rpc("community_challenges_for_me");
  return error ? [] : data || [];
}

export async function react(supabase, toUser, emoji) {
  return supabase.rpc("community_react", { p_to: toUser, p_emoji: emoji });
}

// Ejercicios que el alumno hizo hoy (para elegir su destacado)
export async function todayExercises(supabase, userId) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const { data } = await supabase.from("progress").select("exercise_id, exercises(name)").eq("user_id", userId).gte("completed_at", from.toISOString());
  const seen = new Map();
  (data || []).forEach((p) => { if (p.exercise_id && !seen.has(String(p.exercise_id))) seen.set(String(p.exercise_id), { id: p.exercise_id, name: p.exercises?.name || "Ejercicio" }); });
  return [...seen.values()];
}

// Avisos del coach en la comunidad (los ve quien está en la comunidad de ese coach)
export async function loadPosts(supabase) {
  const { data, error } = await supabase.from("community_posts").select("id, coach_id, body, created_at").order("created_at", { ascending: false }).limit(20);
  return error ? [] : data || [];
}

export async function createPost(supabase, coachId, body) {
  return supabase.from("community_posts").insert({ coach_id: coachId, body: body.trim() });
}

export async function deletePost(supabase, id) {
  return supabase.from("community_posts").delete().eq("id", id);
}

export const challengePct = (c) => Math.max(0, Math.min(100, Math.round(((Number(c.progress) || 0) / Math.max(1, Number(c.target) || 1)) * 100)));
