"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { blockUsesProgression } from "@/lib/blocks";
import { cleanInt } from "@/lib/numbers";
import { SearchSelect } from "@/components/ui/Search";
import { WeightInput } from "@/components/ui/WeightInput";
import { useWeightUnit } from "@/lib/weightUnits";
import { editRoutineExercise, ensurePrivateRoutine, saveCustomWeight, savePlanChange, savePlanValues } from "./exerciseEdits";
import { useBackClose } from "@/lib/backStack";

const num = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};

// Editar un ejercicio desde "Ver su rutina": peso, series, reps, sustituir, quitar, agregar después
// (con la opción de crear un ejercicio nuevo). Con planeación se elige si vale solo esta semana o
// desde esta semana en adelante; sin planeación (semana base) o en un extra, se edita solo para este alumno.
export function ExerciseEditSheet({ student, routine, exercise, plan, planWeek, dayLabel, onClose, onSaved }) {
  useBackClose(true, onClose); // "atrás" del celular cierra esta ventana (no la pantalla de atrás)
  const [unit] = useWeightUnit();
  const part = (routine?.parts || [])[exercise.partIndex ?? 0] || routine;
  const inPlan = !!(plan && planWeek && !part?.isExtra);
  const block = exercise.blockId ? (part?.blocks || []).find((b) => String(b.id) === String(exercise.blockId)) : null;
  const mainBlock = blockUsesProgression(block?.block_type || null);
  const isPrivate = !!(part?.student_id && String(part.student_id) === String(student.id));

  const initial = {
    kg: exercise.targetWeight != null ? String(exercise.targetWeight) : "",
    sets: exercise.setsCount ? String(exercise.setsCount) : "",
    reps: exercise.targetReps || "",
  };
  const [kg, setKg] = useState(initial.kg);
  const [sets, setSets] = useState(initial.sets);
  const [reps, setReps] = useState(initial.reps);
  const [scope, setScope] = useState("week"); // week | from
  const [action, setAction] = useState(null); // null | replace | remove | add
  const [exId, setExId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [newSets, setNewSets] = useState("");
  const [newReps, setNewReps] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("exercises").select("id, name, muscle_group").order("name").then(({ data }) => setCatalog(data || []));
  }, []);
  const options = useMemo(() => catalog.map((e) => ({ value: e.id, label: e.name, sub: e.muscle_group || "" })), [catalog]);

  const changed = {
    kg: String(kg ?? "") !== initial.kg,
    sets: sets !== initial.sets,
    reps: reps.trim() !== initial.reps,
  };
  const anyValue = changed.kg || changed.sets || changed.reps;
  const canChangeExercise = !!exercise.itemKey;

  const field = "w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent";
  const chip = (on) => `flex-1 text-xs rounded-lg px-3 py-2 ${on ? "bg-accent text-app font-semibold" : "bg-field text-soft hover:text-ink"}`;

  const pickExercise = async () => {
    if (exId === "__new__") {
      if (!newName.trim()) throw new Error("Escriba el nombre del ejercicio nuevo.");
      const { data, error } = await supabase.from("exercises").insert({ name: newName.trim(), muscle_group: newGroup.trim() || null, video_url: null }).select("id, name").single();
      if (error || !data) throw new Error("No se pudo crear el ejercicio.");
      return data;
    }
    const ex = catalog.find((e) => String(e.id) === String(exId));
    if (!ex) throw new Error("Elija un ejercicio de la lista o «+ Crear ejercicio nuevo».");
    return ex;
  };

  const save = async () => {
    if (busy) return;
    if (!anyValue && !action) return onClose();
    setBusy(true);
    try {
      const newEx = action === "replace" || action === "add" ? await pickExercise() : null;
      const kgVal = num(kg);
      const setsVal = sets ? Number(sets) : null;
      if (inPlan) {
        if (anyValue && action !== "remove") {
          await savePlanValues({ plan, week: planWeek, exerciseId: exercise.exerciseId, scope, kg: kgVal, sets: setsVal, reps: reps.trim(), currentKg: exercise.targetWeight, changed });
        }
        if (action) {
          await savePlanChange({
            plan, routineId: exercise.routineId || part.id, week: planWeek, scope, action, itemKey: exercise.itemKey,
            currentExerciseId: exercise.exerciseId, newExerciseId: newEx?.id || null,
            sets: newSets ? Number(newSets) : null, reps: newReps.trim() || null,
          });
        }
      } else {
        // Semana base o extra: el peso del trabajo principal va a sus pesos personalizados (no hace falta copiar);
        // lo demás se cambia en una copia de la rutina solo para este alumno.
        const weightToCustom = changed.kg && mainBlock && !part?.isExtra;
        if (weightToCustom) await saveCustomWeight(student.id, exercise.exerciseId, kgVal);
        const needsRoutine = (changed.kg && !weightToCustom) || changed.sets || changed.reps || action;
        if (needsRoutine) {
          if (!isPrivate && !confirm("Para cambiar esto solo para este alumno se crea una copia de la rutina para él (la de la biblioteca no cambia). ¿Seguir?")) {
            setBusy(false);
            return;
          }
          let routineId = part.id;
          let itemKey = exercise.itemKey;
          if (!isPrivate) {
            const res = await ensurePrivateRoutine({ studentId: student.id, part, dayLabel });
            routineId = res.routineId;
            itemKey = res.keyMap?.[exercise.itemKey] || null;
            if (!itemKey) throw new Error("Se creó la copia, pero no se encontró el ejercicio en ella. Ábralo de nuevo e intente otra vez.");
          }
          const patch = {};
          if (changed.kg && !weightToCustom) patch.kg = kgVal;
          if (changed.sets) patch.sets = setsVal;
          if (changed.reps) patch.reps = reps.trim();
          await editRoutineExercise({ routineId, itemKey, patch, action, newExercise: newEx, newSets: newSets ? Number(newSets) : null, newReps: newReps.trim() || null });
        }
      }
      onSaved?.();
      onClose();
    } catch (e) {
      alert(e.message || "No se pudo guardar.");
    }
    setBusy(false);
  };

  const context = inPlan
    ? `Planeación ${plan.name ? `«${plan.name}» ` : ""}· semana ${planWeek} de ${plan.weeks}`
    : part?.isExtra ? "Extra" : "Semana base (sin planeación)";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[70]" onClick={onClose}>
      <div className="bg-deep border border-white/[0.06] w-full max-w-md rounded-t-2xl md:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-accent text-xs font-semibold flex items-center gap-1.5"><SlidersHorizontal size={14} /> Editar ejercicio</p>
            <h2 className="text-ink text-lg font-semibold leading-tight mt-1">{exercise.name}</h2>
            <p className="text-muted text-xs truncate">{part?.title} · {context}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted shrink-0"><X size={20} /></button>
        </div>

        {inPlan && (
          <div className="mb-4">
            <p className="text-soft text-xs mb-1.5">¿Hasta cuándo vale el cambio?</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setScope("week")} className={chip(scope === "week")}>Solo esta semana</button>
              <button type="button" onClick={() => setScope("from")} className={chip(scope === "from")}>Desde esta semana en adelante</button>
            </div>
            {plan.model === "ondulante_diaria" && <p className="text-muted text-[11px] mt-1.5">En la ondulante diaria, el peso, las series y las reps escritos aquí valen para todos los días de la semana.</p>}
          </div>
        )}
        {!inPlan && (
          <p className="text-muted text-[11px] mb-4">
            {isPrivate ? "Esta rutina es solo de este alumno: los cambios valen todas las semanas." : "Sin planeación los cambios valen todas las semanas. El peso del trabajo principal queda como peso personalizado; lo demás se cambia en una copia de la rutina solo para este alumno."}
          </p>
        )}

        {action !== "remove" && (
          <div className="grid grid-cols-3 gap-2 mb-1">
            <label className="block">
              <span className="text-muted text-[11px]">Peso ({unit})</span>
              <WeightInput toggle={false} valueKg={kg} onChangeKg={(v) => setKg(v == null ? "" : String(v))} placeholder="—" className={field} />
            </label>
            <label className="block">
              <span className="text-muted text-[11px]">{block && !inPlan ? "Series (bloque)" : "Series"}</span>
              <input inputMode="numeric" value={sets} onChange={(e) => setSets(cleanInt(e.target.value).slice(0, 2))} placeholder="—" className={field} />
            </label>
            <label className="block">
              <span className="text-muted text-[11px]">Reps</span>
              <input value={reps} maxLength={20} onChange={(e) => setReps(e.target.value)} placeholder="—" className={field} />
            </label>
          </div>
        )}
        {block && !inPlan && action !== "remove" && <p className="text-muted text-[11px] mb-1">Las series de un bloque son las mismas para todos sus ejercicios.</p>}

        <div className="mt-4">
          <p className="text-soft text-xs mb-1.5">Cambiar el ejercicio</p>
          {!canChangeExercise ? (
            <p className="text-muted text-[11px]">Este ejercicio no tiene clave fija: guardá la rutina una vez (Rutinas → editar → guardar) para poder cambiarlo aquí.</p>
          ) : (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setAction(action === "replace" ? null : "replace")} className={chip(action === "replace")}><span className="inline-flex items-center gap-1"><ArrowLeftRight size={12} /> Sustituir</span></button>
              <button type="button" onClick={() => setAction(action === "remove" ? null : "remove")} className={chip(action === "remove")}><span className="inline-flex items-center gap-1"><Trash2 size={12} /> Quitar</span></button>
              <button type="button" onClick={() => setAction(action === "add" ? null : "add")} className={chip(action === "add")}><span className="inline-flex items-center gap-1"><Plus size={12} /> Agregar después</span></button>
            </div>
          )}
          {(action === "replace" || action === "add") && (
            <div className="mt-2 space-y-2">
              <SearchSelect options={options} value={exId}
                topOption={{ value: "__new__", label: "+ Crear ejercicio nuevo" }}
                onChange={(v, typed) => { setExId(v); if (v === "__new__" && !newName) setNewName(typed || ""); }}
                placeholder="Buscar ejercicio del catálogo..." />
              {exId === "__new__" && (
                <div className="grid grid-cols-2 gap-2">
                  <input autoFocus value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del ejercicio nuevo" className={`${field} col-span-2`} />
                  <input value={newGroup} maxLength={40} onChange={(e) => setNewGroup(e.target.value)} placeholder="Grupo muscular (opcional)" className={`${field} col-span-2`} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <input inputMode="numeric" value={newSets} onChange={(e) => setNewSets(cleanInt(e.target.value).slice(0, 2))} placeholder="Series (opcional)" className={field} />
                <input value={newReps} maxLength={20} onChange={(e) => setNewReps(e.target.value)} placeholder="Reps (opcional)" className={field} />
              </div>
            </div>
          )}
          {action === "remove" && <p className="text-muted text-[11px] mt-2">{inPlan ? (scope === "week" ? "Esta semana el alumno no ve este ejercicio; la siguiente vuelve." : "Desde esta semana el alumno ya no ve este ejercicio.") : "El ejercicio se quita de la rutina de este alumno."}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={save} disabled={busy || (!anyValue && !action)} className="flex-1 bg-accent text-app text-sm font-semibold rounded-xl py-2.5 disabled:opacity-50">
            {busy ? "Guardando..." : "Guardar"}
          </button>
          <button onClick={onClose} className="bg-field text-soft text-sm rounded-xl px-4 py-2.5">Cancelar</button>
        </div>
        {inPlan && <p className="text-muted text-[11px] mt-3">Se guarda en su planeación (la rutina original no cambia). También lo podés ver y ajustar en Planeación → Cargas y ejercicios.</p>}
      </div>
    </div>
  );
}
