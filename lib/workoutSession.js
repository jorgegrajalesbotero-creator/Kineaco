// Entrenamiento del día FINALIZADO (tabla workout_sessions): una fila por alumno, semana (lunes) y día.
// Cuando el alumno finaliza, ese día queda bloqueado: no puede marcar/desmarcar series ni cambiar pesos
// (lo impone también la base). El coach puede habilitar la edición y volver a bloquear.
import { localDateString } from "@/lib/dates";
import { addDays, mondayOf } from "@/lib/trainingPlan";

const FIELDS = "id, user_id, week_start, day_label, finished_at, unlocked_at";

// Lunes (AAAA-MM-DD) de la semana actual (weekOffset = 0), la siguiente (1), la anterior (-1)...
export const weekStartISO = (weekOffset = 0) => localDateString(addDays(mondayOf(new Date()), weekOffset * 7));

export const isLocked = (s) => !!(s && s.finished_at && !s.unlocked_at);

// Si la tabla todavía no existe, devuelve null (la app sigue como antes)
export async function loadSession(supabase, userId, weekStart, dayLabel) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(FIELDS)
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .eq("day_label", dayLabel)
    .maybeSingle();
  return error ? null : data;
}

// El alumno finaliza (o vuelve a finalizar después de que el coach habilitó la edición)
export async function finishSession(supabase, { userId, weekStart, dayLabel }) {
  return supabase
    .from("workout_sessions")
    .upsert(
      { user_id: userId, week_start: weekStart, day_label: dayLabel, finished_at: new Date().toISOString(), unlocked_at: null },
      { onConflict: "user_id,week_start,day_label" }
    )
    .select(FIELDS)
    .single();
}

// Coach: habilitar la edición (unlocked = true) o volver a bloquear
export async function setSessionUnlocked(supabase, sessionId, unlocked) {
  return supabase
    .from("workout_sessions")
    .update({ unlocked_at: unlocked ? new Date().toISOString() : null })
    .eq("id", sessionId)
    .select(FIELDS)
    .single();
}

export const fmtFinished = (iso, locale = "es-CO") =>
  iso ? new Date(iso).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
