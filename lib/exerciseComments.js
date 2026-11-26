// Comentarios que el ALUMNO le deja a su coach sobre un ejercicio de su rutina (tabla student_exercise_comments).
// Uno por ejercicio, día y semana; se puede cambiar o borrar. Al coach le llega un aviso.
// Si la tabla todavía no existe, la app sigue igual.

export const COMMENT_MAX = 1000;
export const commentKey = (routineId, itemKey, exerciseId) => `${routineId}|${itemKey || ""}|${exerciseId}`;

// { "routine|item|exercise": fila } de un alumno, una semana y un día
export async function loadExerciseComments(supabase, userId, weekStart, dayLabel, routineIds = null) {
  const q = supabase.from("student_exercise_comments").select("*").eq("user_id", userId).eq("week_start", weekStart).eq("day_label", dayLabel);
  // No se filtra por rutina (routineIds queda por compatibilidad): si el coach cambió la rutina en vivo,
  // la copia conserva la clave de cada ejercicio y el comentario se encuentra por esa clave ("*")
  void routineIds;
  const { data, error } = await q;
  if (error) return {};
  const out = {};
  (data || []).forEach((r) => {
    out[commentKey(r.routine_id, r.item_key, r.exercise_id)] = r;
    if (r.item_key) out[commentKey("*", r.item_key, r.exercise_id)] = r;
  });
  return out;
}

// Texto vacío = se borra
export async function saveExerciseComment(supabase, { userId, routineId, itemKey, exerciseId, weekStart, dayLabel, comment }) {
  const text = String(comment || "").trim().slice(0, COMMENT_MAX);
  let del = supabase.from("student_exercise_comments").delete()
    .eq("user_id", userId).eq("routine_id", routineId).eq("exercise_id", exerciseId).eq("week_start", weekStart).eq("day_label", dayLabel);
  del = itemKey ? del.eq("item_key", itemKey) : del.is("item_key", null);
  if (!text) {
    const { error } = await del;
    return { error, row: null };
  }
  const { data, error } = await supabase
    .from("student_exercise_comments")
    .upsert(
      { user_id: userId, routine_id: routineId, item_key: itemKey || null, exercise_id: exerciseId, week_start: weekStart, day_label: dayLabel, comment: text },
      { onConflict: "user_id,routine_id,item_key,exercise_id,week_start,day_label" }
    )
    .select("*")
    .single();
  return { error, row: data };
}
