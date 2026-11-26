// Reloj programado por el coach en cada bloque de una rutina (tabla routine_timers).
// - user_id vacío: reloj de la rutina (vale para todos los alumnos que la tengan).
// - user_id de un alumno: reloj solo para ese alumno (manda sobre el de la rutina).
// El bloque se identifica por su posición (order_index), porque al guardar una rutina los bloques se recrean.
// Si la tabla todavía no existe, todo sigue funcionando sin reloj programado.
import { normalizeTimer } from "@/lib/clock";

// Relojes de varias rutinas: los de la rutina y, si se pasa uid, los de ese alumno
export async function loadTimers(supabase, routineIds, uid = null) {
  const ids = [...new Set((routineIds || []).filter(Boolean))];
  if (ids.length === 0) return [];
  let q = supabase.from("routine_timers").select("id, routine_id, block_index, user_id, timer").in("routine_id", ids);
  q = uid ? q.or(`user_id.is.null,user_id.eq.${uid}`) : q.is("user_id", null);
  const { data, error } = await q;
  return error ? [] : data || [];
}

// { [block_index]: { timer, custom } } de una rutina: el del alumno manda sobre el de la rutina
export function timersFor(rows, routineId, uid = null) {
  const out = {};
  const mine = (rows || []).filter((r) => r.routine_id === routineId);
  for (const r of mine) {
    if (r.user_id) continue;
    const t = normalizeTimer(r.timer);
    if (t) out[r.block_index] = { timer: t, custom: false, base: t };
  }
  if (uid) {
    for (const r of mine) {
      if (r.user_id !== uid) continue;
      // El coach le quitó a este alumno el reloj de la rutina: ese bloque queda sin reloj
      if (isTimerOff(r.timer)) { out[r.block_index] = { timer: null, custom: true, off: true, base: out[r.block_index]?.base || null }; continue; }
      const t = normalizeTimer(r.timer);
      // "base" = el de la rutina, para mostrar a qué se vuelve si se quita el del alumno
      if (t) out[r.block_index] = { timer: t, custom: true, base: out[r.block_index]?.base || null };
    }
  }
  return out;
}

// Marca para quitarle a UN alumno el reloj que trae la rutina (sin tocar el de los demás)
export const TIMER_OFF = { off: true };
export const isTimerOff = (t) => !!(t && typeof t === "object" && t.off === true);

// Posición especial: reloj de toda la rutina (rutinas en "lista simple")
export const LIST_TIMER_INDEX = -1;

// Guarda los relojes de la rutina después de guardar su contenido.
// mode "bloques": blocks = [{ timer, origIndex }] en el orden nuevo; los relojes de cada alumno siguen a su
//   bloque si se movió y se borran si el bloque se quitó (los bloques nuevos, sin origIndex, empiezan sin ellos).
// mode "lista": listTimer = reloj de toda la rutina.
export async function saveRoutineTimers(supabase, routineId, { mode = "bloques", blocks = [], listTimer = null } = {}) {
  const { error: delErr } = await supabase.from("routine_timers").delete().eq("routine_id", routineId).is("user_id", null);
  if (delErr) return delErr.code === "42P01" ? null : delErr; // sin la tabla: no pasa nada
  const rows =
    mode === "bloques"
      ? blocks.map((b, i) => ({ routine_id: routineId, block_index: i, user_id: null, timer: normalizeTimer(b.timer) }))
      : [{ routine_id: routineId, block_index: LIST_TIMER_INDEX, user_id: null, timer: normalizeTimer(listTimer) }];
  const toInsert = rows.filter((r) => r.timer);
  if (toInsert.length) {
    const { error } = await supabase.from("routine_timers").insert(toInsert);
    if (error) return error;
  }
  // Relojes puestos solo a un alumno: se acomodan al contenido nuevo
  const { data: custom } = await supabase.from("routine_timers").select("id, block_index").eq("routine_id", routineId).not("user_id", "is", null);
  if (!custom?.length) return null;
  const newIndex = {};
  if (mode === "bloques") blocks.forEach((b, i) => { if (Number.isInteger(b.origIndex)) newIndex[b.origIndex] = i; });
  else newIndex[LIST_TIMER_INDEX] = LIST_TIMER_INDEX;
  for (const r of custom) {
    const to = newIndex[r.block_index];
    if (to === undefined) await supabase.from("routine_timers").delete().eq("id", r.id);
    else if (to !== r.block_index) await supabase.from("routine_timers").update({ block_index: to }).eq("id", r.id);
  }
  return null;
}

// Reloj de un bloque solo para un alumno (timer null = quitarlo y volver al de la rutina)
export async function saveStudentTimer(supabase, uid, routineId, blockIndex, timer) {
  const { error: delErr } = await supabase.from("routine_timers").delete().eq("routine_id", routineId).eq("user_id", uid).eq("block_index", blockIndex);
  if (delErr) return delErr;
  const t = isTimerOff(timer) ? TIMER_OFF : normalizeTimer(timer);
  if (!t) return null;
  const { error } = await supabase.from("routine_timers").insert({ routine_id: routineId, block_index: blockIndex, user_id: uid, timer: t });
  return error || null;
}
