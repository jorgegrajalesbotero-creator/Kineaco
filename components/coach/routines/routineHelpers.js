import { blockTypeLabel } from "@/lib/blocks";
import { supabase } from "@/lib/supabaseClient";

export const catalogOptions = (catalog) => catalog.map((c) => ({ value: c.id, label: c.name, sub: c.muscle_group || "" }));

export let tmpKeyCounter = 0;

export function tmpKey() {
  tmpKeyCounter += 1;
  return `tmp-${Date.now()}-${tmpKeyCounter}`;
}

export function defaultBlockTitle(type, blocks) {
  if (type === "principal") {
    return `Bloque ${blocks.filter((b) => b.block_type === "principal").length + 1}`;
  }
  return blockTypeLabel(type);
}

// Guarda el contenido de una rutina de forma ATÓMICA mediante la RPC
// save_routine_content (transacción en Postgres). Antes se borraba y se
// insertaba fila por fila sin transacción: si una inserción fallaba, la
// rutina quedaba vacía o a medias (BUG-M1). Ahora, si algo falla, se
// revierte todo y la rutina conserva su contenido anterior.
export async function writeRoutineContent(routineId, mode, list, blocks) {
  const mapExercise = (ex) => ({
    exercise_id: ex.exerciseId,
    reps: ex.reps ?? "",
    target_weight_kg: ex.targetWeight ?? "",
    rest_minutes: ex.restMinutes ?? "",
    item_key: ex.itemKey ?? "",
  });

  const payloadBlocks =
    mode === "bloques"
      ? blocks.map((bl) => ({
          block_type: bl.block_type,
          title: bl.title ?? "",
          sets: bl.sets ?? "",
          notes: bl.notes ?? "",
          exercises: (bl.exercises || []).map(mapExercise),
        }))
      : [];

  const payloadList =
    mode === "bloques"
      ? []
      : list.map((ex) => ({ ...mapExercise(ex), sets: ex.sets ?? "" }));

  const { error } = await supabase.rpc("save_routine_content", {
    p_routine_id: routineId,
    p_mode: mode,
    p_blocks: payloadBlocks,
    p_list: payloadList,
  });
  return error || null;
}

export function autoRoutineTitle() {
  return `Rutina ${new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}`;
}

export function switchRoutineMode(target, mode, setMode, list, setList, blocks, setBlocks) {
  if (target === mode) return;
  if (target === "bloques") {
    if (list.length > 0) {
      setBlocks(listToBlocks(list));
      setList([]);
    }
  } else {
    if (blocks.some((b) => b.exercises.length > 0) && !confirm("Se van a quitar los bloques y todos los ejercicios quedarán en una sola lista. ¿Continuar?")) return;
    setList(blocks.flatMap((b) => b.exercises.map((e) => ({ ...e, sets: b.sets }))));
    setBlocks([]);
  }
  setMode(target);
}

const setsKey = (v) => (v && String(v) !== "0" ? String(v) : "");

// Pasa una lista a bloques sin perder las series: los ejercicios seguidos con las mismas series quedan en el mismo bloque
export function listToBlocks(list, startNumber = 1) {
  const blocks = [];
  let n = startNumber - 1;
  for (const e of list) {
    const sets = setsKey(e.sets);
    const item = { itemKey: e.itemKey || null, exerciseId: e.exerciseId, name: e.name, reps: e.reps, targetWeight: e.targetWeight, restMinutes: e.restMinutes };
    const last = blocks[blocks.length - 1];
    if (last && last.sets === sets) last.exercises.push(item);
    else {
      n += 1;
      blocks.push({ key: tmpKey(), block_type: "principal", title: `Bloque ${n}`, sets, notes: "", exercises: [item] });
    }
  }
  return blocks;
}

// Lee los ejercicios y bloques de una rutina guardada
export async function loadRoutineContent(routineId) {
  const [{ data: exData }, { data: blockData }] = await Promise.all([
    supabase
      .from("routine_exercises")
      .select("exercise_id, block_id, item_key, sets, reps, order_index, target_weight_kg, rest_minutes, exercises(name, video_url)")
      .eq("routine_id", routineId)
      .order("order_index"),
    supabase
      .from("routine_blocks")
      .select("id, block_type, title, sets, notes, order_index")
      .eq("routine_id", routineId)
      .order("order_index"),
  ]);
  const toItem = (e) => ({
    itemKey: e.item_key || null,
    exerciseId: e.exercise_id,
    name: e.exercises?.name || "",
    sets: String(e.sets ?? ""),
    reps: e.reps || "",
    targetWeight: e.target_weight_kg != null ? String(e.target_weight_kg) : "",
    restMinutes: e.rest_minutes != null ? String(e.rest_minutes) : "",
  });
  if ((blockData || []).length > 0) {
    return {
      mode: "bloques",
      list: [],
      blocks: blockData.map((b) => ({
        key: b.id,
        block_type: b.block_type,
        title: b.title || "",
        sets: b.sets != null ? String(b.sets) : "",
        notes: b.notes || "",
        exercises: (exData || []).filter((e) => e.block_id === b.id).map(toItem),
      })),
    };
  }
  return { mode: "lista", list: (exData || []).map(toItem), blocks: [] };
}

// Fusiona el contenido de otra rutina al final de la que se está editando.
// Lo que se copia queda como ejercicios nuevos (sin item_key), para no mezclar el historial de la otra rutina.
export function mergeRoutineContent(current, other) {
  const fresh = (e) => ({ ...e, itemKey: null });
  if (current.mode === "lista" && other.mode === "lista") {
    return { mode: "lista", list: [...current.list, ...other.list.map(fresh)], blocks: [] };
  }
  const base = current.mode === "bloques" ? current.blocks : listToBlocks(current.list);
  let extra =
    other.mode === "bloques"
      ? other.blocks.map((b) => ({ ...b, key: tmpKey(), exercises: b.exercises.map(fresh) }))
      : listToBlocks(other.list.map(fresh));
  // Un solo estiramiento al final: se quitan los estiramientos vacíos de la otra rutina
  // y lo nuevo entra antes del estiramiento de esta rutina
  const isStretch = (b) => b.block_type === "estiramiento";
  const tailStart = base.length > 0 && isStretch(base[base.length - 1]) ? base.length - 1 : base.length;
  if (tailStart < base.length) extra = extra.filter((b) => !(isStretch(b) && b.exercises.length === 0));
  const blocks = [...base.slice(0, tailStart), ...extra, ...base.slice(tailStart)];
  // Vuelve a numerar los bloques de trabajo que tienen el nombre automático ("Bloque N")
  let n = 0;
  return {
    mode: "bloques",
    list: [],
    blocks: blocks.map((b) => {
      if (b.block_type !== "principal") return b;
      n += 1;
      return /^Bloque \d+$/.test(b.title.trim()) ? { ...b, title: `Bloque ${n}` } : b;
    }),
  };
}
