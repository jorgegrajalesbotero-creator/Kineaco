// Cambios de ejercicios dentro de la planeación de UN alumno, sin tocar la rutina original.
// Cada cambio vale "desde la semana N" del plan (de ahí en adelante):
//   - remove:  quita el ejercicio (item_key) de la rutina
//   - replace: lo sustituye por otro ejercicio (conserva su lugar, su bloque y su item_key)
//   - add:     agrega un ejercicio después de otro (after_item_key) o al final de la rutina
// Si hay varios cambios sobre el mismo ejercicio, manda el de semana más alta que ya empezó.
// Lo usan el coach (Cargas) y el alumno (su rutina del día, calendario y PDF).

const fromWeek = (c) => Number(c.from_week) || 1;

// Cambios de una rutina que ya rigen en esa semana
export function activeChanges(changes, routineId, week) {
  return (changes || []).filter((c) => String(c.routine_id) === String(routineId) && fromWeek(c) <= (Number(week) || 1));
}

// items: filas de routine_exercises de UNA rutina, ya ordenadas
// ({ exercise_id, block_id, item_key, sets, reps, order_index, target_weight_kg, rest_minutes, exercises: { name, video_url } })
// changes: filas de training_plan_exercise_changes (con exercises(name, video_url) del ejercicio nuevo)
// Devuelve los items con los cambios aplicados; los cambiados llevan planChange: "replace" | "add".
export function applyPlanChanges(items, changes, routineId, week) {
  const list = items || [];
  const active = activeChanges(changes, routineId, week);
  if (active.length === 0) return list;

  // Último cambio (remove/replace) que rige para cada ejercicio de la rutina
  const latest = new Map();
  active
    .filter((c) => c.action !== "add" && c.item_key)
    .forEach((c) => {
      const k = String(c.item_key);
      const prev = latest.get(k);
      if (!prev || fromWeek(c) > fromWeek(prev) || (fromWeek(c) === fromWeek(prev) && String(c.created_at || "") >= String(prev.created_at || ""))) latest.set(k, c);
    });

  const adds = active
    .filter((c) => c.action === "add" && c.exercise_id)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
  const addsAfter = new Map();
  adds.forEach((c) => {
    const k = c.after_item_key ? String(c.after_item_key) : "";
    addsAfter.set(k, [...(addsAfter.get(k) || []), c]);
  });

  const out = [];
  const placed = new Set();
  const emitAdds = (anchorKey, anchorItem) => {
    (addsAfter.get(anchorKey) || []).forEach((c) => {
      if (placed.has(c.id || c.new_item_key)) return;
      placed.add(c.id || c.new_item_key);
      const item = {
        exercise_id: c.exercise_id,
        block_id: anchorItem ? anchorItem.block_id ?? null : null,
        item_key: c.new_item_key,
        sets: c.sets ?? anchorItem?.sets ?? null,
        reps: c.reps || "",
        target_weight_kg: null,
        rest_minutes: c.rest_minutes ?? null,
        exercises: c.exercises || { name: c.exercise_name || "Ejercicio", video_url: "" },
        planChange: "add",
        planChangeFrom: fromWeek(c),
      };
      out.push(item);
      emitAdds(String(c.new_item_key), item); // un agregado puede ir después de otro agregado
    });
  };

  list.forEach((it) => {
    const ch = it.item_key ? latest.get(String(it.item_key)) : null;
    if (!ch) out.push(it);
    else if (ch.action === "replace" && ch.exercise_id) {
      out.push({
        ...it,
        exercise_id: ch.exercise_id,
        exercises: ch.exercises || { name: ch.exercise_name || "Ejercicio", video_url: "" },
        reps: ch.reps || it.reps,
        sets: ch.sets ?? it.sets,
        rest_minutes: ch.rest_minutes ?? it.rest_minutes,
        target_weight_kg: null, // el peso de la rutina era del ejercicio anterior
        planChange: "replace",
        planChangeFrom: fromWeek(ch),
        replacedName: it.exercises?.name || "",
      });
    }
    // remove: no se agrega, pero lo que iba después de él se conserva en su lugar
    const anchorItem = out[out.length - 1] && out[out.length - 1].item_key === it.item_key ? out[out.length - 1] : it;
    if (it.item_key) emitAdds(String(it.item_key), anchorItem);
  });
  emitAdds("", null); // los que van al final de la rutina
  // Agregados cuyo ejercicio de referencia ya no está en la rutina: al final
  adds.forEach((c) => { if (!placed.has(c.id || c.new_item_key)) { addsAfter.set("__huerfano", [c]); emitAdds("__huerfano", null); } });

  return out.map((it, i) => ({ ...it, order_index: i }));
}

// Texto corto de un cambio para mostrarlo (coach)
export function describeChange(c, nameOfItem) {
  const desde = `Desde S${fromWeek(c)}`;
  const nuevo = c.exercises?.name || c.exercise_name || "Ejercicio";
  if (c.action === "remove") return `${desde}: se quita ${nameOfItem(c.item_key) || "un ejercicio"}`;
  if (c.action === "replace") return `${desde}: ${nameOfItem(c.item_key) || "ejercicio"} → ${nuevo}`;
  return `${desde}: se agrega ${nuevo}${c.after_item_key ? ` después de ${nameOfItem(c.after_item_key) || "otro ejercicio"}` : " al final"}`;
}
