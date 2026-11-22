// Dar por hecho el bloque cuando el reloj termina.
//
// Hasta ahora el reloj era solo un cronómetro: el alumno terminaba su Tabata y los ejercicios
// seguían pendientes en la rutina. Aquí se marcan solos, con las mismas columnas que usa el
// marcado a mano (components/student/RoutineScreen.jsx y components/student/SetLogger.jsx).
//
// La decisión de QUÉ marcar es una función pura (planBlockMarks) para poder probarla sin
// base de datos; markBlockDone solo lee lo ya hecho, la llama y guarda lo que falta.
import { currentWeekStartISO } from "@/lib/dates";

const firstNumber = (text) => {
  const m = String(text || "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

// Clave con la que se identifica un ejercicio dentro de una rutina (igual que setKey en RoutineScreen)
export const exKey = (ex) => `${ex.routineId}|${ex.itemKey ?? ex.exerciseId}`;

// Cuántas series del bloque da por hechas un reloj que acaba de terminar.
// Tabata: las series que corrió. AMRAP y los demás: el ejercicio entero (el alumno ya trabajó
// todo el tiempo, así que dejarlo a medias no tendría sentido).
export function setsFromClock(mode, cfg) {
  if (mode === "tabata" || mode === "intervals") return { sets: Math.max(1, Number(cfg?.sets) || 1), allSets: false };
  return { sets: 1, allSets: true };
}

// Qué habría que guardar, sabiendo lo que ya está hecho. No toca la base de datos.
//   exercises  = los del reloj, ya con identidad (ver cleanExercises en lib/clockStore.js)
//   sets       = series que corrió el reloj · allSets = dar el ejercicio por completo
//   doneSets   = { "routineId|itemKey": [números de serie ya marcados] }
//   doneDone   = Set de claves de ejercicios ya completados
// Devuelve { setRows, doneRows }: lo que falta, sin repetir nunca lo que ya existe.
export function planBlockMarks(exercises, { sets = 1, allSets = false, doneSets = {}, doneDone = new Set() } = {}) {
  const setRows = [];
  const doneRows = [];
  for (const ex of exercises || []) {
    if (!ex || !ex.exerciseId || !ex.routineId) continue; // el reloj suelto no marca nada
    const key = exKey(ex);
    const bySet = !!ex.byItem && !!ex.itemKey && ex.setsCount > 0;
    if (bySet) {
      const ya = new Set(doneSets[key] || []);
      const hasta = allSets ? ex.setsCount : Math.min(sets, ex.setsCount);
      for (let n = 1; n <= hasta; n++) if (!ya.has(n)) setRows.push({ ex, setNumber: n });
      const total = ya.size + setRows.filter((r) => r.ex === ex).length;
      if (total >= ex.setsCount && !doneDone.has(key)) doneRows.push({ ex });
    } else if (!doneDone.has(key)) {
      // Los bloques de intermitentes suelen venir sin series: se marca el ejercicio entero
      doneRows.push({ ex });
    }
  }
  return { setRows, doneRows };
}

// Lee lo ya hecho esta semana, decide y guarda. Devuelve cuántas filas escribió.
export async function markBlockDone(supabase, userId, { exercises, dayLabel, mode, cfg }) {
  const list = (exercises || []).filter((e) => e && e.exerciseId && e.routineId);
  if (!userId || !dayLabel || !list.length) return { sets: 0, done: 0 };
  const routineIds = [...new Set(list.map((e) => e.routineId))];
  const semana = currentWeekStartISO();

  const [setsRes, doneRes] = await Promise.all([
    supabase
      .from("progress_sets")
      .select("routine_id, item_key, exercise_id, set_number")
      .eq("user_id", userId)
      .in("routine_id", routineIds)
      .eq("day_label", dayLabel)
      .gte("completed_at", semana),
    supabase
      .from("progress")
      .select("routine_id, item_key, exercise_id")
      .eq("user_id", userId)
      .in("routine_id", routineIds)
      .eq("day_label", dayLabel)
      .gte("completed_at", semana),
  ]);

  const doneSets = {};
  for (const r of setsRes?.data || []) {
    const k = `${r.routine_id}|${r.item_key ?? r.exercise_id}`;
    (doneSets[k] = doneSets[k] || []).push(r.set_number);
  }
  const doneDone = new Set((doneRes?.data || []).map((r) => `${r.routine_id}|${r.item_key ?? r.exercise_id}`));

  const { sets, allSets } = setsFromClock(mode, cfg);
  const { setRows, doneRows } = planBlockMarks(list, { sets, allSets, doneSets, doneDone });

  if (setRows.length) {
    await supabase.from("progress_sets").insert(
      setRows.map(({ ex, setNumber }) => ({
        user_id: userId,
        routine_id: ex.routineId,
        exercise_id: ex.exerciseId,
        item_key: ex.itemKey,
        day_label: dayLabel,
        set_number: setNumber,
        weight_kg: ex.targetWeight ?? null,
        reps: firstNumber(ex.targetReps),
      })),
    );
  }
  if (doneRows.length) {
    await supabase.from("progress").insert(
      doneRows.map(({ ex }) => ({
        user_id: userId,
        routine_id: ex.routineId,
        exercise_id: ex.exerciseId,
        item_key: ex.itemKey || null,
        day_label: dayLabel,
        weight_kg: ex.targetWeight ?? null,
      })),
    );
  }
  return { sets: setRows.length, done: doneRows.length };
}
