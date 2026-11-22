// Comentarios de la rutina escritos por el coach para UN alumno (tabla student_routine_notes).
// - Nota de un bloque: pisa la que trae la rutina (routine_blocks.notes), solo para ese alumno.
// - block_index = -1: comentario de todo el día, arriba de la rutina.
// El bloque se identifica por su posición y no por su id, igual que los relojes
// (lib/routineTimers.js): al guardar una rutina sus bloques se recrean y los id cambian.
// Si la tabla todavía no existe, todo sigue funcionando sin comentarios.

export const ROUTINE_NOTE_INDEX = -1; // comentario de toda la rutina
export const ROUTINE_NOTE_MAX = 1000; // lo mismo que las observaciones por ejercicio

// Notas de varias rutinas para un alumno
export async function loadRoutineNotes(supabase, routineIds, uid) {
  const ids = [...new Set((routineIds || []).filter(Boolean))];
  if (!ids.length || !uid) return [];
  const { data, error } = await supabase
    .from("student_routine_notes")
    .select("routine_id, block_index, note")
    .in("routine_id", ids)
    .eq("user_id", uid);
  return error ? [] : data || [];
}

// { [block_index]: note } de una rutina
export function notesFor(rows, routineId) {
  const out = {};
  for (const r of rows || []) {
    if (r.routine_id !== routineId) continue;
    const texto = typeof r.note === "string" ? r.note.trim() : "";
    if (texto) out[r.block_index] = texto;
  }
  return out;
}

// Comentario de un bloque (o del día) solo para un alumno. Con el texto vacío se borra,
// que es como se vuelve a la nota que trae la rutina.
export async function saveStudentNote(supabase, uid, routineId, blockIndex, note) {
  const { error: delErr } = await supabase
    .from("student_routine_notes")
    .delete()
    .eq("routine_id", routineId)
    .eq("user_id", uid)
    .eq("block_index", blockIndex);
  if (delErr) return delErr;
  const texto = String(note ?? "").trim().slice(0, ROUTINE_NOTE_MAX);
  if (!texto) return null;
  const { error } = await supabase
    .from("student_routine_notes")
    .insert({ routine_id: routineId, block_index: blockIndex, user_id: uid, note: texto });
  return error || null;
}

// Al guardar una rutina sus bloques se recrean, y pueden haberse movido o quitado: las notas
// de cada alumno siguen a su bloque y se borran si el bloque desapareció. Es lo mismo que
// hace saveRoutineTimers con los relojes; sin esto, las notas quedarían en el bloque de al lado.
export async function reindexStudentNotes(supabase, routineId, { mode = "bloques", blocks = [] } = {}) {
  const { data, error } = await supabase
    .from("student_routine_notes")
    .select("id, block_index")
    .eq("routine_id", routineId);
  if (error || !data?.length) return null;

  const nuevoIndice = {};
  if (mode === "bloques") blocks.forEach((b, i) => { if (Number.isInteger(b.origIndex)) nuevoIndice[b.origIndex] = i; });
  nuevoIndice[ROUTINE_NOTE_INDEX] = ROUTINE_NOTE_INDEX; // el comentario del día no se mueve

  for (const r of data) {
    const destino = nuevoIndice[r.block_index];
    if (destino === undefined) await supabase.from("student_routine_notes").delete().eq("id", r.id);
    else if (destino !== r.block_index) await supabase.from("student_routine_notes").update({ block_index: destino }).eq("id", r.id);
  }
  return null;
}
