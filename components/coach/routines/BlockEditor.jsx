"use client";

import { useState } from "react";
import { DndContext, closestCenter, pointerWithin, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, Copy, Pencil, Plus, Timer, Trash2, X } from "lucide-react";
import { DragHandle, SortableRow, arrayMove, keyOf, useDragSensors } from "@/components/ui/Sortable";
import { useUndo } from "@/components/ui/UndoToast";
import { BLOCK_TYPES, blockTypeLabel } from "@/lib/blocks";
import { catalogOptions, defaultBlockTitle, tmpKey } from "@/components/coach/routines/routineHelpers";
import { SearchSelect } from "@/components/ui/Search";
import { Select } from "@/components/ui/Select";
import { ExerciseItemEditor } from "@/components/coach/routines/ExerciseItemEditor";
import { WeightInput } from "@/components/ui/WeightInput";
import { formatWeight, useWeightUnit } from "@/lib/weightUnits";
import { timerLabel } from "@/lib/clock";
import { TimerSettings } from "@/components/coach/TimerSettings";

export function BlockEditor({ blocks, setBlocks, catalog, onCreateExercise }) {
  const [newType, setNewType] = useState("principal");
  const [forms, setForms] = useState({});
  const [editing, setEditing] = useState(null); // { block: key, index }
  const [timerOpen, setTimerOpen] = useState(null); // bloque con el reloj desplegado
  const [unit] = useWeightUnit();

  const updateBlock = (key, patch) => setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const { offer, toast } = useUndo();
  const [picked, setPicked] = useState(null); // null = normal; Set de claves de ejercicios = eligiendo varios
  const exId = (ex) => `e:${keyOf(ex)}`;
  const moveBlock = (index, dir) =>
    setBlocks((bs) => {
      const target = index + dir;
      if (target < 0 || target >= bs.length) return bs;
      return arrayMove(bs, index, target);
    });
  // Quitar un bloque ya no pregunta: sale "Deshacer" unos segundos
  const removeBlock = (block) => {
    const prev = blocks;
    setBlocks((bs) => bs.filter((b) => b.key !== block.key));
    setEditing(null);
    offer(`Se quitó el bloque «${block.title || blockTypeLabel(block.block_type)}»`, () => setBlocks(prev));
  };
  const duplicateBlock = (block) => {
    const copy = { ...block, key: tmpKey(), title: block.title ? `${block.title} (copia)` : "", exercises: block.exercises.map((e) => ({ ...e, itemKey: null })) };
    setBlocks((bs) => { const i = bs.findIndex((b) => b.key === block.key); return [...bs.slice(0, i + 1), copy, ...bs.slice(i + 1)]; });
  };

  // Arrastrar: los bloques se ordenan entre sí; los ejercicios se ordenan dentro de su bloque o pasan a otro
  const sensors = useDragSensors();
  const blockOfEx = (id) => blocks.find((b) => b.exercises.some((e) => exId(e) === id));
  const collision = (args) => {
    const type = args.active.data.current?.type;
    const all = args.droppableContainers;
    if (type === "block") return closestCenter({ ...args, droppableContainers: all.filter((c) => c.data.current?.type === "block") });
    const exs = all.filter((c) => c.data.current?.type === "ex");
    const zones = all.filter((c) => c.data.current?.type === "zone");
    const hit = pointerWithin({ ...args, droppableContainers: zones })[0];
    if (hit) {
      const bk = zones.find((z) => z.id === hit.id)?.data.current?.block;
      const inBlock = exs.filter((c) => c.data.current?.block === bk);
      return inBlock.length ? closestCenter({ ...args, droppableContainers: inBlock }) : [hit];
    }
    return closestCenter({ ...args, droppableContainers: exs });
  };
  const targetOf = (over) => {
    const d = over?.data.current;
    if (!d) return null;
    if (d.type === "zone") return { block: d.block, id: null };
    if (d.type === "ex") return { block: d.block, id: over.id };
    return null;
  };
  // Pasar un ejercicio a otro bloque mientras se arrastra (así se ve dónde va a caer)
  const onDragOver = ({ active, over }) => {
    if (active.data.current?.type !== "ex") return;
    const to = targetOf(over);
    const from = blockOfEx(active.id);
    if (!to || !from || to.block === from.key) return;
    setBlocks((bs) => {
      const src = bs.find((b) => b.key === from.key);
      const dst = bs.find((b) => b.key === to.block);
      if (!src || !dst) return bs;
      const item = src.exercises.find((e) => exId(e) === active.id);
      if (!item) return bs;
      let at = to.id ? dst.exercises.findIndex((e) => exId(e) === to.id) : dst.exercises.length;
      if (at < 0) at = dst.exercises.length;
      return bs.map((b) => {
        if (b.key === src.key) return { ...b, exercises: b.exercises.filter((e) => e !== item) };
        if (b.key === dst.key) return { ...b, exercises: [...b.exercises.slice(0, at), item, ...b.exercises.slice(at)] };
        return b;
      });
    });
  };
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    if (active.data.current?.type === "block") {
      const from = blocks.findIndex((b) => `b:${b.key}` === active.id);
      const to = blocks.findIndex((b) => `b:${b.key}` === over.id);
      if (from >= 0 && to >= 0) setBlocks((bs) => arrayMove(bs, from, to));
      return;
    }
    const t = targetOf(over);
    const b = blockOfEx(active.id);
    if (!t || !b || t.block !== b.key || !t.id) return;
    const from = b.exercises.findIndex((e) => exId(e) === active.id);
    const to = b.exercises.findIndex((e) => exId(e) === t.id);
    if (from >= 0 && to >= 0 && from !== to) updateBlock(b.key, { exercises: arrayMove(b.exercises, from, to) });
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
    const prev = blocks;
    setEditing(null);
    updateBlock(block.key, { exercises: block.exercises.filter((_, i) => i !== index) });
    offer(`Se quitó ${block.exercises[index]?.name || "el ejercicio"}`, () => setBlocks(prev));
  };
  const saveExercise = (block, index, patch) => {
    updateBlock(block.key, { exercises: block.exercises.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)) });
    setEditing(null);
  };
  // Con las flechas: dentro del bloque; en el borde, pasa al bloque de arriba o de abajo
  const moveExercise = (block, index, dir) => {
    setEditing(null);
    const target = index + dir;
    if (target >= 0 && target < block.exercises.length) {
      updateBlock(block.key, { exercises: arrayMove(block.exercises, index, target) });
      return;
    }
    const bi = blocks.findIndex((b) => b.key === block.key);
    const other = blocks[bi + dir];
    if (!other) return;
    const item = block.exercises[index];
    setBlocks((bs) => bs.map((b) => {
      if (b.key === block.key) return { ...b, exercises: b.exercises.filter((e) => e !== item) };
      if (b.key === other.key) return { ...b, exercises: dir < 0 ? [...b.exercises, item] : [item, ...b.exercises] };
      return b;
    }));
  };

  // Elegir varios ejercicios (de cualquier bloque): duplicar, quitar o pasar a otro bloque
  const allEx = blocks.flatMap((b) => b.exercises);
  const togglePick = (ex) => setPicked((s) => { const n = new Set(s); const k = keyOf(ex); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const isPicked = (ex) => !!picked?.has(keyOf(ex));
  const removePicked = () => {
    const prev = blocks;
    const n = picked.size;
    setBlocks((bs) => bs.map((b) => ({ ...b, exercises: b.exercises.filter((e) => !picked.has(keyOf(e))) })));
    setPicked(null);
    offer(n === 1 ? "Se quitó 1 ejercicio" : `Se quitaron ${n} ejercicios`, () => setBlocks(prev));
  };
  const duplicatePicked = () => {
    setBlocks((bs) => bs.map((b) => ({ ...b, exercises: b.exercises.flatMap((e) => (picked.has(keyOf(e)) ? [e, { ...e, itemKey: null }] : [e])) })));
    setPicked(null);
  };
  const movePickedTo = (blockKey) => {
    if (!blockKey) return;
    const moving = allEx.filter((e) => picked.has(keyOf(e)));
    setBlocks((bs) => bs.map((b) => {
      const rest = b.exercises.filter((e) => !picked.has(keyOf(e)));
      return b.key === blockKey ? { ...b, exercises: [...rest, ...moving] } : { ...b, exercises: rest };
    }));
    setPicked(null);
  };

  const inputCls = "bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none min-w-0";
  const iconBtn = "w-8 h-8 rounded-lg bg-field text-soft flex items-center justify-center disabled:opacity-30";

  return (
    <div className="space-y-3 mb-6">
      {toast}
      {allEx.length > 1 && (
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          {picked ? (
            <>
              <span className="text-muted mr-auto">{picked.size} elegidos</span>
              <button type="button" disabled={!picked.size} onClick={duplicatePicked} className="flex items-center gap-1 text-soft hover:text-accent disabled:opacity-40"><Copy size={12} /> Duplicar</button>
              {blocks.length > 1 && (
                <Select aria-label="Pasar a otro bloque" value="" disabled={!picked.size} onChange={(e) => movePickedTo(e.target.value)} className="!py-1 !text-xs">
                  <option value="">Pasar a...</option>
                  {blocks.map((b) => <option key={b.key} value={b.key}>{b.title || blockTypeLabel(b.block_type)}</option>)}
                </Select>
              )}
              <button type="button" disabled={!picked.size} onClick={removePicked} className="flex items-center gap-1 text-soft hover:text-danger disabled:opacity-40"><Trash2 size={12} /> Quitar</button>
              <button type="button" onClick={() => setPicked(null)} className="text-muted hover:text-ink">Listo</button>
            </>
          ) : (
            <button type="button" onClick={() => { setPicked(new Set()); setEditing(null); }} className="text-muted hover:text-accent">Elegir varios ejercicios</button>
          )}
        </div>
      )}
      {blocks.length === 0 && (
        <p className="text-muted text-sm bg-card rounded-xl p-4">
          Esta rutina todavía no tiene bloques. Elija un tipo de bloque abajo y agréguelo.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={() => setEditing(null)} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <SortableContext items={blocks.map((b) => `b:${b.key}`)} strategy={verticalListSortingStrategy}>
      <div className="space-y-3">
      {blocks.map((b, i) => {
        const f = formOf(b.key);
        return (
          <SortableRow key={b.key} id={`b:${b.key}`} data={{ type: "block" }}>{(blockHandle) => (
          <div className="bg-card rounded-xl p-4">
            <div className="flex items-start gap-2 mb-3">
              <DragHandle {...blockHandle} onKeyMove={(dir) => moveBlock(i, dir)} className="mt-6" label="Mover bloque (arrastre o use las flechas ↑ ↓)" />
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
                <button type="button" onClick={() => duplicateBlock(b)} className={`${iconBtn} hover:text-accent`} aria-label="Duplicar bloque" title="Duplicar bloque"><Copy size={13} /></button>
                <button type="button" onClick={() => removeBlock(b)} className={`${iconBtn} hover:text-danger`} aria-label="Quitar bloque"><X size={14} /></button>
              </div>
            </div>

            <div className="grid grid-cols-[120px_1fr] gap-2 mb-3">
              <div className="relative">
                <input type="number" min="1" placeholder="Nº" value={b.sets} onChange={(e) => updateBlock(b.key, { sets: e.target.value })} className={`${inputCls} w-full pr-14`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">series</span>
              </div>
              <input placeholder="Nota para el alumno (opcional)" value={b.notes} onChange={(e) => updateBlock(b.key, { notes: e.target.value })} className={inputCls} />
            </div>

            {/* Reloj programado para este bloque (el alumno lo abre con un toque y lo puede ajustar) */}
            <div className="mb-3">
              <button type="button" onClick={() => setTimerOpen(timerOpen === b.key ? null : b.key)} aria-expanded={timerOpen === b.key}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-left ${b.timer ? "bg-accent/15 text-accent" : "bg-field/60 text-soft hover:text-ink"}`}>
                <Timer size={14} />
                <span className="flex-1">{b.timer ? `Reloj: ${timerLabel(b.timer)}` : "Programar reloj (opcional): Tabata, intervalos, AMRAP..."}</span>
                <ChevronDown size={14} className={`transition-transform ${timerOpen === b.key ? "rotate-180" : ""}`} />
              </button>
              {timerOpen === b.key && (
                <div className="mt-2">
                  <TimerSettings value={b.timer || null} onChange={(t) => updateBlock(b.key, { timer: t })} />
                </div>
              )}
            </div>

            <ExerciseZone blockKey={b.key}>
            <SortableContext items={b.exercises.map(exId)} strategy={verticalListSortingStrategy}>
              {b.exercises.map((ex, j) => (
                <SortableRow key={exId(ex)} id={exId(ex)} data={{ type: "ex", block: b.key }} disabled={!!picked || (editing?.block === b.key && editing.index === j)}>{(handle) =>
                editing?.block === b.key && editing.index === j ? (
                  <ExerciseItemEditor
                    item={ex}
                    catalog={catalog}
                    onSave={(patch) => saveExercise(b, j, patch)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                <div className={`flex items-center gap-2 bg-field/60 rounded-lg pl-2 pr-3 py-2 ${isPicked(ex) ? "ring-1 ring-accent/60" : ""}`}>
                  {picked ? (
                    <input type="checkbox" checked={isPicked(ex)} onChange={() => togglePick(ex)} aria-label={`Elegir ${ex.name}`} className="w-4 h-4 ml-1 accent-[var(--color-accent)] shrink-0" />
                  ) : (
                    <DragHandle {...handle} onKeyMove={(dir) => moveExercise(b, j, dir)} />
                  )}
                  <div className="flex-1 min-w-0">
                    <button type="button" onClick={() => (picked ? togglePick(ex) : setEditing({ block: b.key, index: j }))} className="text-ink text-sm truncate block max-w-full text-left hover:text-accent">{ex.name}</button>
                    <p className="text-muted text-xs">
                      {[ex.reps && `${ex.reps} reps`, ex.targetWeight && formatWeight(ex.targetWeight, unit), ex.restMinutes && `descanso ${ex.restMinutes} min`].filter(Boolean).join(" · ") || "Sin detalle"}
                    </p>
                  </div>
                  {!picked && <button type="button" onClick={() => removeExercise(b, j)} className="text-muted hover:text-danger px-1" aria-label="Quitar ejercicio"><X size={14} /></button>}
                </div>
                )}</SortableRow>
              ))}
            </SortableContext>
              {b.exercises.length === 0 && <p className="text-muted text-xs italic py-2">Todavía no hay ejercicios en este bloque. Puede arrastrar uno aquí desde otro bloque.</p>}
            </ExerciseZone>

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
              <WeightInput placeholder="Peso" valueKg={f.targetWeight} onChangeKg={(kg) => setForm(b.key, { targetWeight: kg })} className={`${inputCls} w-full`} />
              <input placeholder="Descanso" value={f.restMinutes} onChange={(e) => setForm(b.key, { restMinutes: e.target.value })} className={inputCls} />
            </div>
            <button type="button" onClick={() => addExercise(b)} disabled={addingKey === b.key} className="mt-2 bg-field text-accent px-4 py-2 rounded-lg text-sm flex items-center gap-1 disabled:opacity-60">
              <Plus size={15} /> {addingKey === b.key ? "Creando ejercicio..." : "Agregar ejercicio al bloque"}
            </button>
          </div>
          )}</SortableRow>
        );
      })}
      </div>
      </SortableContext>
      </DndContext>

      <div className="flex flex-col sm:flex-row gap-2 bg-card rounded-xl p-3 border border-dashed border-field">
        <Select aria-label="Tipo de bloque" value={newType} onChange={(e) => setNewType(e.target.value)} className="flex-1 min-w-0">
          {BLOCK_TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </Select>
        <button type="button" onClick={addBlock} className="bg-accent text-app font-medium px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-1">
          <Plus size={15} /> Agregar bloque
        </button>
      </div>
    </div>
  );
}

// Zona de ejercicios de un bloque: también recibe ejercicios arrastrados desde otro bloque (aunque esté vacío)
function ExerciseZone({ blockKey, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${blockKey}`, data: { type: "zone", block: blockKey } });
  return <div ref={setNodeRef} className={`space-y-1.5 mb-3 rounded-lg transition-colors ${isOver ? "bg-accent/[0.06]" : ""}`}>{children}</div>;
}
