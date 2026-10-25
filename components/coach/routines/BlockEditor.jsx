"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { BLOCK_TYPES, blockTypeLabel } from "@/lib/blocks";
import { catalogOptions, defaultBlockTitle, tmpKey } from "@/components/coach/routines/routineHelpers";
import { SearchSelect } from "@/components/ui/Search";
import { ExerciseItemEditor } from "@/components/coach/routines/ExerciseItemEditor";

export function BlockEditor({ blocks, setBlocks, catalog, onCreateExercise }) {
  const [newType, setNewType] = useState("principal");
  const [forms, setForms] = useState({});
  const [editing, setEditing] = useState(null); // { block: key, index }

  const updateBlock = (key, patch) => setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const moveBlock = (index, dir) =>
    setBlocks((bs) => {
      const target = index + dir;
      if (target < 0 || target >= bs.length) return bs;
      const copy = [...bs];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  const removeBlock = (block) => {
    if (block.exercises.length > 0 && !confirm(`¿Quitar el bloque "${block.title || blockTypeLabel(block.block_type)}" con sus ejercicios?`)) return;
    setBlocks((bs) => bs.filter((b) => b.key !== block.key));
  };
  const addBlock = () =>
    setBlocks((bs) => [...bs, { key: tmpKey(), block_type: newType, title: defaultBlockTitle(newType, bs), sets: "", notes: "", exercises: [] }]);

  const emptyForm = { exerciseId: "", newName: "", newGroup: "", reps: "", targetWeight: "", restMinutes: "" };
  const [addingKey, setAddingKey] = useState(null);
  const formOf = (key) => forms[key] || emptyForm;
  const setForm = (key, patch) => setForms((f) => ({ ...f, [key]: { ...formOf(key), ...patch } }));
  const addExercise = async (block) => {
    const f = formOf(block.key);
    let chosen = null;
    if (f.exerciseId === "__new__") {
      if (!f.newName.trim()) {
        alert("Escriba el nombre del ejercicio nuevo.");
        return;
      }
      setAddingKey(block.key);
      chosen = await onCreateExercise(f.newName, f.newGroup);
      setAddingKey(null);
      if (!chosen) return;
    } else {
      if (!f.exerciseId) {
        alert("Elija un ejercicio de la lista o la opción \"+ Crear ejercicio nuevo\".");
        return;
      }
      chosen = catalog.find((c) => c.id === f.exerciseId);
      if (!chosen) return;
    }
    updateBlock(block.key, {
      exercises: [
        ...block.exercises,
        { itemKey: null, exerciseId: chosen.id, name: chosen.name, reps: f.reps, targetWeight: f.targetWeight, restMinutes: f.restMinutes },
      ],
    });
    setForms((all) => ({ ...all, [block.key]: emptyForm }));
  };
  const removeExercise = (block, index) => {
    setEditing(null);
    updateBlock(block.key, { exercises: block.exercises.filter((_, i) => i !== index) });
  };
  const saveExercise = (block, index, patch) => {
    updateBlock(block.key, { exercises: block.exercises.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)) });
    setEditing(null);
  };
  const moveExercise = (block, index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= block.exercises.length) return;
    const copy = [...block.exercises];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    updateBlock(block.key, { exercises: copy });
    setEditing(null);
  };

  const inputCls = "bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none min-w-0";
  const iconBtn = "w-8 h-8 rounded-lg bg-field text-soft flex items-center justify-center disabled:opacity-30";

  return (
    <div className="space-y-3 mb-6">
      {blocks.length === 0 && (
        <p className="text-muted text-sm bg-card rounded-xl p-4">
          Esta rutina todavía no tiene bloques. Elija un tipo de bloque abajo y agréguelo.
        </p>
      )}

      {blocks.map((b, i) => {
        const f = formOf(b.key);
        return (
          <div key={b.key} className="bg-card rounded-xl p-4">
            <div className="flex items-start gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-accent text-[11px] uppercase tracking-wider mb-1">Tipo: {blockTypeLabel(b.block_type)}</p>
                <div className="relative">
                  <input
                    value={b.title}
                    onChange={(e) => updateBlock(b.key, { title: e.target.value })}
                    placeholder={`Nombre del bloque (ej: ${blockTypeLabel(b.block_type)})`}
                    className="w-full bg-field text-ink font-medium rounded-lg pl-3 pr-9 py-2 outline-none focus:ring-1 focus:ring-accent"
                  />
                  <Pencil size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0} className={iconBtn} aria-label="Subir bloque">↑</button>
                <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} className={iconBtn} aria-label="Bajar bloque">↓</button>
                <button type="button" onClick={() => removeBlock(b)} className={`${iconBtn} hover:text-danger`} aria-label="Quitar bloque"><Trash2 size={13} /></button>
              </div>
            </div>

            <div className="grid grid-cols-[120px_1fr] gap-2 mb-3">
              <div className="relative">
                <input type="number" min="1" placeholder="Nº" value={b.sets} onChange={(e) => updateBlock(b.key, { sets: e.target.value })} className={`${inputCls} w-full pr-14`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">series</span>
              </div>
              <input placeholder="Nota para el alumno (opcional)" value={b.notes} onChange={(e) => updateBlock(b.key, { notes: e.target.value })} className={inputCls} />
            </div>

            <div className="space-y-1.5 mb-3">
              {b.exercises.map((ex, j) =>
                editing?.block === b.key && editing.index === j ? (
                  <ExerciseItemEditor
                    key={`edit-${j}`}
                    item={ex}
                    catalog={catalog}
                    onSave={(patch) => saveExercise(b, j, patch)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                <div key={`${ex.exerciseId}-${j}`} className="flex items-center gap-2 bg-field/60 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <button type="button" onClick={() => setEditing({ block: b.key, index: j })} className="text-ink text-sm truncate block max-w-full text-left hover:text-accent">{ex.name}</button>
                    <p className="text-muted text-xs">
                      {[ex.reps && `${ex.reps} reps`, ex.targetWeight && `${ex.targetWeight} kg`, ex.restMinutes && `descanso ${ex.restMinutes} min`].filter(Boolean).join(" · ") || "Sin detalle"}
                    </p>
                  </div>
                  <button type="button" onClick={() => moveExercise(b, j, -1)} disabled={j === 0} className="text-muted text-xs px-1 disabled:opacity-30" aria-label="Subir">↑</button>
                  <button type="button" onClick={() => moveExercise(b, j, 1)} disabled={j === b.exercises.length - 1} className="text-muted text-xs px-1 disabled:opacity-30" aria-label="Bajar">↓</button>
                  <button type="button" onClick={() => setEditing({ block: b.key, index: j })} className="text-muted hover:text-ink px-1" aria-label="Editar ejercicio"><Pencil size={13} /></button>
                  <button type="button" onClick={() => removeExercise(b, j)} className="text-muted hover:text-danger px-1" aria-label="Quitar ejercicio"><Trash2 size={13} /></button>
                </div>
                )
              )}
              {b.exercises.length === 0 && <p className="text-muted text-xs italic">Todavía no hay ejercicios en este bloque.</p>}
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <SearchSelect
                className="col-span-3"
                options={catalogOptions(catalog)}
                value={f.exerciseId}
                topOption={{ value: "__new__", label: "+ Crear ejercicio nuevo" }}
                placeholder="Buscar ejercicio del catálogo..."
                onChange={(id, typed) => setForm(b.key, id === "__new__" ? { exerciseId: id, newName: f.newName || typed || "" } : { exerciseId: id })}
              />
              {f.exerciseId === "__new__" && (
                <>
                  <input autoFocus placeholder="Nombre del ejercicio nuevo" value={f.newName} onChange={(e) => setForm(b.key, { newName: e.target.value })} className={`col-span-2 md:col-span-4 ${inputCls}`} />
                  <input placeholder="Grupo muscular (opcional)" value={f.newGroup} onChange={(e) => setForm(b.key, { newGroup: e.target.value })} className={`col-span-1 md:col-span-2 ${inputCls}`} />
                </>
              )}
              <input placeholder="Reps" value={f.reps} onChange={(e) => setForm(b.key, { reps: e.target.value })} className={inputCls} />
              <input placeholder="Peso (kg)" value={f.targetWeight} onChange={(e) => setForm(b.key, { targetWeight: e.target.value })} className={inputCls} />
              <input placeholder="Descanso" value={f.restMinutes} onChange={(e) => setForm(b.key, { restMinutes: e.target.value })} className={inputCls} />
            </div>
            <button type="button" onClick={() => addExercise(b)} disabled={addingKey === b.key} className="mt-2 bg-field text-accent px-4 py-2 rounded-lg text-sm flex items-center gap-1 disabled:opacity-60">
              <Plus size={15} /> {addingKey === b.key ? "Creando ejercicio..." : "Agregar ejercicio al bloque"}
            </button>
          </div>
        );
      })}

      <div className="flex flex-col sm:flex-row gap-2 bg-card rounded-xl p-3 border border-dashed border-field">
        <select value={newType} onChange={(e) => setNewType(e.target.value)} className={`flex-1 ${inputCls}`}>
          {BLOCK_TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <button type="button" onClick={addBlock} className="bg-accent text-app font-medium px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-1">
          <Plus size={15} /> Agregar bloque
        </button>
      </div>
    </div>
  );
}
