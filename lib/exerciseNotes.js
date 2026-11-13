// Observaciones del coach por ejercicio, para UN alumno (tabla student_exercise_notes).
// Cada observación va en un lugar de una rutina (routine_id + item_key) y para un ejercicio:
// si la planeación sustituye el ejercicio, el sustituto tiene su propia observación.
// Vale todas las semanas y no cambia la rutina ni la planeación (ATR).
// La usan el alumno (su rutina del día) y el coach (ver rutina del alumno y Cargas de la planeación).

export const NOTE_MAX = 1000;
export const noteKey = (routineId, itemKey, exerciseId) => `${routineId}|${itemKey}|${exerciseId}`;

const FIELDS = "id, routine_id, item_key, exercise_id, note, updated_at";

// { "rutina|item|ejercicio": fila } — si la tabla todavía no existe, devuelve {} (la app sigue igual)
export async function loadExerciseNotes(supabase, userId, routineIds = null) {
  if (!userId) return {};
  let q = supabase.from("student_exercise_notes").select(FIELDS).eq("user_id", userId);
  if (routineIds) {
    if (routineIds.length === 0) return {};
    q = q.in("routine_id", routineIds);
  }
  const { data, error } = await q;
  const map = {};
  if (!error) (data || []).forEach((n) => { map[noteKey(n.routine_id, n.item_key, n.exercise_id)] = n; });
  return map;
}

export const noteFor = (notes, routineId, itemKey, exerciseId) =>
  (itemKey && notes ? notes[noteKey(routineId, itemKey, exerciseId)]?.note : null) || null;

// Guarda (o borra, si el texto queda vacío) la observación de un ejercicio para un alumno
export async function saveExerciseNote(supabase, { userId, routineId, itemKey, exerciseId, note }) {
  const text = String(note || "").trim().slice(0, NOTE_MAX);
  const match = (q) => q.eq("user_id", userId).eq("routine_id", routineId).eq("item_key", String(itemKey)).eq("exercise_id", exerciseId);
  if (!text) {
    const { error } = await match(supabase.from("student_exercise_notes").delete());
    return { error, row: null };
  }
  const { data, error } = await supabase
    .from("student_exercise_notes")
    .upsert(
      { user_id: userId, routine_id: routineId, item_key: String(itemKey), exercise_id: exerciseId, note: text },
      { onConflict: "user_id,routine_id,item_key,exercise_id" }
    )
    .select(FIELDS)
    .single();
  return { error, row: data };
}
