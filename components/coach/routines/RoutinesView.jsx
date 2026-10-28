"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, Clock, Copy, Download, GitMerge, GripVertical, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { matchesSearch } from "@/lib/search";
import { supabase } from "@/lib/supabaseClient";
import { downloadRoutinePdf } from "@/lib/planPdf";
import { BlockEditor } from "@/components/coach/routines/BlockEditor";
import { autoRoutineTitle, catalogOptions, loadRoutineContent, mergeRoutineContent, switchRoutineMode, writeRoutineContent } from "@/components/coach/routines/routineHelpers";
import { ExerciseItemEditor } from "@/components/coach/routines/ExerciseItemEditor";
import { AssignRoutineModal } from "@/components/coach/routines/AssignRoutineModal";
import { RoutineModeToggle } from "@/components/coach/routines/RoutineModeToggle";
import { SearchInput, SearchSelect } from "@/components/ui/Search";

// Lista simple de ejercicios: cada uno se puede editar (lápiz), mover o quitar
function ListItems({ items, setItems, catalog }) {
  const [editing, setEditing] = useState(null);
  const move = (i, dir) => {
    const t = i + dir;
    if (t < 0 || t >= items.length) return;
    const copy = [...items];
    [copy[i], copy[t]] = [copy[t], copy[i]];
    setItems(copy);
    setEditing(null);
  };
  return (
    <div className="space-y-2 mb-3">
      {items.map((ex, i) =>
        editing === i ? (
          <ExerciseItemEditor
            key={`edit-${i}`}
            item={ex}
            catalog={catalog}
            showSets
            onSave={(patch) => { setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x))); setEditing(null); }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div key={i} className="flex items-center gap-2 bg-card rounded-lg px-3 py-2.5">
            <GripVertical size={14} className="text-muted shrink-0" />
            <button type="button" onClick={() => setEditing(i)} className="text-ink text-sm flex-1 min-w-0 truncate text-left hover:text-accent">{ex.name}</button>
            <span className="text-muted text-xs shrink-0">
              {[ex.sets && ex.sets !== "0" ? `${ex.sets}×${ex.reps || "—"}` : ex.reps, ex.targetWeight ? `${ex.targetWeight}kg` : ""].filter(Boolean).join(" · ")}
            </span>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-muted text-xs px-1 disabled:opacity-30" aria-label="Subir">↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-muted text-xs px-1 disabled:opacity-30" aria-label="Bajar">↓</button>
            <button type="button" onClick={() => setEditing(i)} className="text-muted hover:text-ink px-1" aria-label="Editar ejercicio"><Pencil size={13} /></button>
            <button type="button" onClick={() => { setItems(items.filter((_, j) => j !== i)); setEditing(null); }} className="text-muted hover:text-danger px-1" aria-label="Quitar ejercicio"><Trash2 size={13} /></button>
          </div>
        )
      )}
    </div>
  );
}

export function RoutinesView() {
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [routineSearch, setRoutineSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: "", level: "Principiante", goal: "", duration: "" });
  const [draftExercises, setDraftExercises] = useState([]);
  const [exForm, setExForm] = useState({ exerciseId: "", sets: "", reps: "", targetWeight: "", restMinutes: "" });
  const [saving, setSaving] = useState(false);
  const [draftMode, setDraftMode] = useState("lista");
  const [draftBlocks, setDraftBlocks] = useState([]);
  const [editMode, setEditMode] = useState("lista");
  const [editBlocks, setEditBlocks] = useState([]);

  const [viewingId, setViewingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: "", level: "Principiante", goal: "", duration: "" });
  const [editExercises, setEditExercises] = useState([]);
  const [editExForm, setEditExForm] = useState({ exerciseId: "", sets: "", reps: "", targetWeight: "", restMinutes: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeId, setMergeId] = useState("");
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergedFrom, setMergedFrom] = useState([]); // rutinas ya fusionadas en esta edición
  const [deleteMerged, setDeleteMerged] = useState(false);
  const [busyId, setBusyId] = useState(null); // rutina de la lista en la que se está trabajando (duplicar/PDF/eliminar)
  const [assignRoutine, setAssignRoutine] = useState(null); // rutina que se está asignando a un alumno
  const [selectMode, setSelectMode] = useState(false); // modo "marcar varias"
  const [selected, setSelected] = useState([]); // ids marcados
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function loadRoutines() {
    setLoading(true);
    const { data: routinesData } = await supabase
      .from("routines")
      .select("*, routine_exercises(id), routine_blocks(id)")
      .order("created_at", { ascending: false });
    setRoutines(routinesData || []);
    setLoading(false);
  }

  async function loadCatalog() {
    const { data } = await supabase.from("exercises").select("id, name, muscle_group").order("name");
    setCatalog(data || []);
  }

  useEffect(() => { loadRoutines(); loadCatalog(); }, []);

  const createExercise = async (name, group) => {
    const { data, error } = await supabase
      .from("exercises")
      .insert({ name: name.trim(), muscle_group: group?.trim() || null, video_url: null })
      .select("id, name, muscle_group")
      .single();
    if (error || !data) {
      alert("No se pudo crear el ejercicio.");
      return null;
    }
    setCatalog((c) => [...c, data].sort((x, y) => x.name.localeCompare(y.name)));
    return data;
  };

  const addExerciseToDraft = async () => {
    let chosen = null;
    if (exForm.exerciseId === "__new__") {
      if (!exForm.newName?.trim()) {
        alert("Escriba el nombre del ejercicio nuevo.");
        return;
      }
      chosen = await createExercise(exForm.newName, exForm.newGroup);
      if (!chosen) return;
    } else {
      if (!exForm.exerciseId) {
        alert("Elija un ejercicio de la lista o la opción \"+ Crear ejercicio nuevo\".");
        return;
      }
      chosen = catalog.find((c) => c.id === exForm.exerciseId);
      if (!chosen) return;
    }
    setDraftExercises((d) => [...d, { exerciseId: chosen.id, name: chosen.name, sets: exForm.sets, reps: exForm.reps, targetWeight: exForm.targetWeight, restMinutes: exForm.restMinutes }]);
    setExForm({ exerciseId: "", sets: "", reps: "", targetWeight: "", restMinutes: "" });
  };

  const saveRoutine = async () => {
    setSaving(true);
    const routineTitle = draft.title.trim() || autoRoutineTitle();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: newRoutine, error: routineError } = await supabase
      .from("routines")
      .insert({
        title: routineTitle,
        level: draft.level.toLowerCase(),
        goal: draft.goal,
        duration_minutes: Number(draft.duration) || 0,
        created_by: user?.id,
      })
      .select()
      .single();

    if (routineError || !newRoutine) {
      alert("Error al guardar la rutina.");
      setSaving(false);
      return;
    }

    const contentError = await writeRoutineContent(newRoutine.id, draftMode, draftExercises, draftBlocks);
    if (contentError) {
      alert("La rutina se creó, pero hubo un error al guardar sus ejercicios: ");
    }

    setDraft({ title: "", level: "Principiante", goal: "", duration: "" });
    setDraftExercises([]);
    setDraftBlocks([]);
    setDraftMode("lista");
    setCreating(false);
    setSaving(false);
    loadRoutines();
  };

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "Principiante");

  const openDetail = async (routine) => {
    setViewingId(routine.id);
    setEditDraft({
      title: routine.title || "",
      level: capitalize(routine.level),
      goal: routine.goal || "",
      duration: String(routine.duration_minutes ?? ""),
    });

    const content = await loadRoutineContent(routine.id);
    setEditMode(content.mode);
    setEditBlocks(content.blocks);
    setEditExercises(content.list);
  };

  const closeDetail = () => {
    setViewingId(null);
    setEditExercises([]);
    setEditBlocks([]);
    setEditMode("lista");
    setEditExForm({ exerciseId: "", sets: "", reps: "", targetWeight: "", restMinutes: "" });
    setMergeOpen(false);
    setMergeId("");
    setMergedFrom([]);
    setDeleteMerged(false);
  };

  // Trae los ejercicios de otra rutina al final de esta (queda en pantalla; se guarda con "Guardar cambios")
  const mergeRoutine = async () => {
    const other = routines.find((r) => r.id === mergeId);
    if (!other) return alert("Elegí la rutina que querés fusionar con esta.");
    setMergeBusy(true);
    const otherContent = await loadRoutineContent(other.id);
    setMergeBusy(false);
    if (otherContent.list.length === 0 && otherContent.blocks.every((b) => b.exercises.length === 0)) {
      return alert("Esa rutina no tiene ejercicios.");
    }
    const merged = mergeRoutineContent({ mode: editMode, list: editExercises, blocks: editBlocks }, otherContent);
    setEditMode(merged.mode);
    setEditExercises(merged.list);
    setEditBlocks(merged.blocks);
    setMergedFrom((m) => [...m, { id: other.id, title: other.title }]);
    setMergeId("");
    setMergeOpen(false);
  };

  const addExerciseToEdit = async () => {
    let chosen = null;
    if (editExForm.exerciseId === "__new__") {
      if (!editExForm.newName?.trim()) {
        alert("Escriba el nombre del ejercicio nuevo.");
        return;
      }
      chosen = await createExercise(editExForm.newName, editExForm.newGroup);
      if (!chosen) return;
    } else {
      if (!editExForm.exerciseId) {
        alert("Elija un ejercicio de la lista o la opción \"+ Crear ejercicio nuevo\".");
        return;
      }
      chosen = catalog.find((c) => c.id === editExForm.exerciseId);
      if (!chosen) return;
    }
    setEditExercises((d) => [...d, { exerciseId: chosen.id, name: chosen.name, sets: editExForm.sets, reps: editExForm.reps, targetWeight: editExForm.targetWeight, restMinutes: editExForm.restMinutes }]);
    setEditExForm({ exerciseId: "", sets: "", reps: "", targetWeight: "", restMinutes: "" });
  };

  const saveEdit = async () => {
    if (!viewingId) return;
    setSavingEdit(true);

    const { error: updateError } = await supabase
      .from("routines")
      .update({
        title: editDraft.title.trim() || autoRoutineTitle(),
        level: editDraft.level.toLowerCase(),
        goal: editDraft.goal,
        duration_minutes: Number(editDraft.duration) || 0,
      })
      .eq("id", viewingId);

    if (updateError) {
      alert("Error al actualizar la rutina: ");
      setSavingEdit(false);
      return;
    }

    const contentError = await writeRoutineContent(viewingId, editMode, editExercises, editBlocks);
    if (contentError) {
      alert("Error al guardar los ejercicios de la rutina: ");
      setSavingEdit(false);
      return;
    }

    if (deleteMerged && mergedFrom.length > 0) {
      const ids = mergedFrom.map((m) => m.id).filter((id) => id !== viewingId);
      const { error: delErr } = await supabase.from("routines").delete().in("id", ids);
      if (delErr) alert("La rutina se guardó, pero no se pudieron eliminar las rutinas fusionadas: ");
    }

    setSavingEdit(false);
    closeDetail();
    loadRoutines();
  };

  const deleteRoutine = async () => {
    if (!viewingId) return;
    if (!confirm("¿Seguro que querés eliminar esta rutina? También se va a quitar de los alumnos y programas que la tengan. El historial de entrenamientos de los alumnos se conserva.")) return;
    setDeleting(true);

    // Los ejercicios, bloques, asignaciones y días de programa se borran solos (ON DELETE CASCADE).
    // El historial de los alumnos se conserva (progress.routine_id queda vacío).
    const { error } = await supabase.from("routines").delete().eq("id", viewingId);

    setDeleting(false);
    if (error) {
      alert(
        error.code === "23503"
          ? "No se pudo eliminar: la rutina todavía está conectada al historial de entrenamientos. Falta correr el SQL de arreglo en Supabase."
          : "No se pudo eliminar la rutina: "
      );
      return;
    }
    closeDetail();
    loadRoutines();
  };

  // Eliminar una rutina directo desde la lista (sin abrirla)
  const deleteFromList = async (r) => {
    if (!confirm(`¿Eliminar la rutina "${r.title}"? También se quita de los alumnos y programas que la tengan. El historial de entrenamientos se conserva.`)) return;
    setBusyId(r.id);
    const { error } = await supabase.from("routines").delete().eq("id", r.id);
    setBusyId(null);
    if (error) {
      alert(
        error.code === "23503"
          ? "No se pudo eliminar: la rutina todavía está conectada al historial de entrenamientos. Falta correr el SQL de arreglo en Supabase."
          : "No se pudo eliminar la rutina: "
      );
      return;
    }
    setSelected((s) => s.filter((id) => id !== r.id));
    loadRoutines();
  };

  // Duplicar una rutina (copia el título, los datos, los bloques y los ejercicios)
  const duplicateRoutine = async (r) => {
    setBusyId(r.id);
    const { data: { user } } = await supabase.auth.getUser();
    const content = await loadRoutineContent(r.id);
    const { data: nr, error } = await supabase
      .from("routines")
      .insert({ title: `${r.title} (copia)`, level: r.level, goal: r.goal, duration_minutes: r.duration_minutes || 0, created_by: user?.id })
      .select("id")
      .single();
    if (error || !nr) {
      setBusyId(null);
      return alert("No se pudo duplicar la rutina.");
    }
    const strip = (arr) => arr.map((e) => ({ ...e, itemKey: null }));
    const list = strip(content.list);
    const blocks = content.blocks.map((b) => ({ ...b, exercises: strip(b.exercises) }));
    const cErr = await writeRoutineContent(nr.id, content.mode, list, blocks);
    setBusyId(null);
    if (cErr) alert("La copia se creó, pero hubo un error al copiar sus ejercicios: ");
    loadRoutines();
  };

  // Descargar una rutina en PDF desde la lista
  const pdfFromList = async (r) => {
    setBusyId(r.id);
    try {
      await downloadRoutinePdf({ supabase, routineIds: [r.id] });
    } catch (e) {
      alert("No se pudo generar el PDF: ");
    }
    setBusyId(null);
  };

  const toggleSelected = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const exitSelectMode = () => { setSelectMode(false); setSelected([]); };

  const bulkDelete = async () => {
    if (selected.length === 0) return;
    if (!confirm(`¿Eliminar ${selected.length} ${selected.length === 1 ? "rutina" : "rutinas"}? También se quitan de los alumnos y programas que las tengan. El historial se conserva.`)) return;
    setBulkDeleting(true);
    const { error } = await supabase.from("routines").delete().in("id", selected);
    setBulkDeleting(false);
    if (error) {
      alert(
        error.code === "23503"
          ? "No se pudieron eliminar: alguna todavía está conectada al historial. Falta correr el SQL de arreglo en Supabase."
          : "No se pudieron eliminar: "
      );
      return;
    }
    exitSelectMode();
    loadRoutines();
  };

  if (creating) {
    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-ink text-xl font-semibold">Nueva rutina</h2>
          <button onClick={() => setCreating(false)} className="text-muted"><X size={20} /></button>
        </div>

        <div className="bg-card rounded-xl p-5 mb-4 space-y-3">
          <div>
            <p className="text-muted text-xs mb-1">Título de la rutina (opcional)</p>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Si lo deja vacío, se nombra con la fecha" className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-muted text-xs mb-1">Nivel</p>
              <select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none">
                <option>Principiante</option>
                <option>Intermedio</option>
                <option>Avanzado</option>
              </select>
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Objetivo</p>
              <input value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} placeholder="Fuerza, cardio..." className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Duración (min)</p>
              <input type="number" value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
            </div>
          </div>
        </div>

        <p className="text-muted text-xs uppercase tracking-wider mb-2">Ejercicios de esta rutina</p>
        <RoutineModeToggle
          mode={draftMode}
          onChange={(m) => switchRoutineMode(m, draftMode, setDraftMode, draftExercises, setDraftExercises, draftBlocks, setDraftBlocks)}
        />
        {draftMode === "bloques" ? (
          <BlockEditor blocks={draftBlocks} setBlocks={setDraftBlocks} catalog={catalog} onCreateExercise={createExercise} />
        ) : (
          <>
            <ListItems items={draftExercises} setItems={setDraftExercises} catalog={catalog} />

            <div className="bg-card rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <SearchSelect
                  className="col-span-2"
                  options={catalogOptions(catalog)}
                  value={exForm.exerciseId}
                  topOption={{ value: "__new__", label: "+ Crear ejercicio nuevo" }}
                  placeholder="Buscar ejercicio del catálogo..."
                  onChange={(id, typed) => setExForm((f) => (id === "__new__" ? { ...f, exerciseId: id, newName: f.newName || typed || "" } : { ...f, exerciseId: id }))}
                />
                {exForm.exerciseId === "__new__" && (
                  <>
                    <input autoFocus placeholder="Nombre del ejercicio nuevo" value={exForm.newName || ""} onChange={(e) => setExForm({ ...exForm, newName: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                    <input placeholder="Grupo muscular (opcional)" value={exForm.newGroup || ""} onChange={(e) => setExForm({ ...exForm, newGroup: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                  </>
                )}
                <input placeholder="Series" value={exForm.sets} onChange={(e) => setExForm({ ...exForm, sets: e.target.value })} className="bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                <input placeholder="Reps" value={exForm.reps} onChange={(e) => setExForm({ ...exForm, reps: e.target.value })} className="bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                <input placeholder="Peso sugerido (kg) - opcional" value={exForm.targetWeight} onChange={(e) => setExForm({ ...exForm, targetWeight: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none mt-2" /><input placeholder="Descanso (min) - opcional" value={exForm.restMinutes} onChange={(e) => setExForm({ ...exForm, restMinutes: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none mt-2" />
              </div>
              <button onClick={addExerciseToDraft} className="mt-2 bg-field text-accent px-4 py-2 rounded-lg text-sm flex items-center gap-1"><Plus size={15} /> Agregar a la rutina</button>
              {catalog.length === 0 && <p className="text-muted text-xs italic mt-2">Todavía no hay ejercicios en tu catálogo — cargalos primero en la pestaña "Ejercicios".</p>}
            </div>
          </>
        )}

        <button onClick={saveRoutine} disabled={saving} className="bg-accent text-app font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-60">
          {saving ? "Guardando..." : "Guardar rutina"}
        </button>
      </div>
    );
  }

  if (viewingId) {
    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-ink text-xl font-semibold">Editar rutina</h2>
          <button onClick={closeDetail} className="text-muted"><X size={20} /></button>
        </div>

        <div className="bg-card rounded-xl p-5 mb-4 space-y-3">
          <div>
            <p className="text-muted text-xs mb-1">Título de la rutina (opcional)</p>
            <input value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-muted text-xs mb-1">Nivel</p>
              <select value={editDraft.level} onChange={(e) => setEditDraft({ ...editDraft, level: e.target.value })} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none">
                <option>Principiante</option>
                <option>Intermedio</option>
                <option>Avanzado</option>
              </select>
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Objetivo</p>
              <input value={editDraft.goal} onChange={(e) => setEditDraft({ ...editDraft, goal: e.target.value })} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Duración (min)</p>
              <input type="number" value={editDraft.duration} onChange={(e) => setEditDraft({ ...editDraft, duration: e.target.value })} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
            </div>
          </div>
        </div>

        <p className="text-muted text-xs uppercase tracking-wider mb-2">Ejercicios de esta rutina</p>
        <RoutineModeToggle
          mode={editMode}
          onChange={(m) => switchRoutineMode(m, editMode, setEditMode, editExercises, setEditExercises, editBlocks, setEditBlocks)}
        />
        {editMode === "bloques" ? (
          <BlockEditor blocks={editBlocks} setBlocks={setEditBlocks} catalog={catalog} onCreateExercise={createExercise} />
        ) : (
          <>
            <ListItems items={editExercises} setItems={setEditExercises} catalog={catalog} />
            {editExercises.length === 0 && <p className="text-muted text-xs italic mb-3">Todavía no hay ejercicios en esta rutina.</p>}

            <div className="bg-card rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <SearchSelect
                  className="col-span-2"
                  options={catalogOptions(catalog)}
                  value={editExForm.exerciseId}
                  topOption={{ value: "__new__", label: "+ Crear ejercicio nuevo" }}
                  placeholder="Buscar ejercicio del catálogo..."
                  onChange={(id, typed) => setEditExForm((f) => (id === "__new__" ? { ...f, exerciseId: id, newName: f.newName || typed || "" } : { ...f, exerciseId: id }))}
                />
                {editExForm.exerciseId === "__new__" && (
                  <>
                    <input autoFocus placeholder="Nombre del ejercicio nuevo" value={editExForm.newName || ""} onChange={(e) => setEditExForm({ ...editExForm, newName: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                    <input placeholder="Grupo muscular (opcional)" value={editExForm.newGroup || ""} onChange={(e) => setEditExForm({ ...editExForm, newGroup: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                  </>
                )}
                <input placeholder="Series" value={editExForm.sets} onChange={(e) => setEditExForm({ ...editExForm, sets: e.target.value })} className="bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                <input placeholder="Reps" value={editExForm.reps} onChange={(e) => setEditExForm({ ...editExForm, reps: e.target.value })} className="bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                <input placeholder="Peso sugerido (kg) - opcional" value={editExForm.targetWeight} onChange={(e) => setEditExForm({ ...editExForm, targetWeight: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none mt-2" /><input placeholder="Descanso (min) - opcional" value={editExForm.restMinutes} onChange={(e) => setEditExForm({ ...editExForm, restMinutes: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none mt-2" />
              </div>
              <button onClick={addExerciseToEdit} className="mt-2 bg-field text-accent px-4 py-2 rounded-lg text-sm flex items-center gap-1"><Plus size={15} /> Agregar a la rutina</button>
              {catalog.length === 0 && <p className="text-muted text-xs italic mt-2">Todavía no hay ejercicios en tu catálogo — cargalos primero en la pestaña "Ejercicios".</p>}
            </div>
          </>
        )}

        <div className="bg-card rounded-xl p-4 mb-6">
          {!mergeOpen ? (
            <button type="button" onClick={() => setMergeOpen(true)} className="text-accent text-sm flex items-center gap-2">
              <GitMerge size={15} /> Fusionar con otra rutina
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-ink text-sm font-medium flex items-center gap-2"><GitMerge size={15} className="text-accent" /> Fusionar con otra rutina</p>
              <p className="text-muted text-xs">Los ejercicios de la rutina que elijas se agregan al final de esta. Revisá el resultado y tocá "Guardar cambios".</p>
              <SearchSelect
                options={routines
                  .filter((r) => r.id !== viewingId && !mergedFrom.some((m) => m.id === r.id))
                  .map((r) => ({ value: r.id, label: r.title, sub: `${r.routine_exercises?.length || 0} ejercicios` }))}
                value={mergeId}
                onChange={(id) => setMergeId(id)}
                placeholder="Buscar rutina..."
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setMergeOpen(false); setMergeId(""); }} className="text-muted text-xs px-3 py-1.5">Cancelar</button>
                <button type="button" onClick={mergeRoutine} disabled={!mergeId || mergeBusy} className="bg-accent text-app text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {mergeBusy ? "Trayendo..." : "Fusionar"}
                </button>
              </div>
            </div>
          )}
          {mergedFrom.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <p className="text-soft text-xs mb-2">Fusionada con: {mergedFrom.map((m) => m.title).join(", ")} (todavía sin guardar)</p>
              <label className="flex items-start gap-2 text-xs text-soft cursor-pointer">
                <input type="checkbox" checked={deleteMerged} onChange={(e) => setDeleteMerged(e.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" />
                <span>Al guardar, eliminar {mergedFrom.length === 1 ? "esa rutina" : "esas rutinas"} para que no queden repetidas. Si algún alumno o programa la tiene asignada, se le quita (el historial se conserva).</span>
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={saveEdit} disabled={savingEdit} className="bg-accent text-app font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-60">
            {savingEdit ? "Guardando..." : "Guardar cambios"}
          </button>
          <button onClick={deleteRoutine} disabled={deleting} className="text-danger text-sm flex items-center gap-1.5 disabled:opacity-60">
            <Trash2 size={15} /> {deleting ? "Eliminando..." : "Eliminar rutina"}
          </button>
        </div>
      </div>
    );
  }

  const visible = routines.filter((r) => matchesSearch(routineSearch, r.title, r.level, r.goal));
  const quickBtn = "flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 bg-field text-soft hover:text-ink disabled:opacity-40";

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h2 className="text-ink text-xl font-semibold">Rutinas</h2>
          <p className="text-muted text-sm">{loading ? "Cargando..." : `${routines.length} rutinas creadas`}</p>
        </div>
        <div className="flex items-center gap-2">
          {routines.length > 0 && (
            selectMode ? (
              <button onClick={exitSelectMode} className="text-soft text-sm px-3 py-2">Cancelar</button>
            ) : (
              <button onClick={() => setSelectMode(true)} className="bg-field text-soft text-sm font-medium px-3 py-2 rounded-lg">Seleccionar</button>
            )
          )}
          <button onClick={() => setCreating(true)} className="bg-accent text-app font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2"><Plus size={16} /> Nueva rutina</button>
        </div>
      </div>

      {selectMode && (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-card rounded-xl px-4 py-3 mb-4">
          <p className="text-soft text-sm">{selected.length === 0 ? "Marque las rutinas que quiere eliminar." : `${selected.length} ${selected.length === 1 ? "rutina marcada" : "rutinas marcadas"}.`}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(visible.map((r) => r.id))} className="text-accent text-xs">Marcar todas</button>
            <button onClick={bulkDelete} disabled={selected.length === 0 || bulkDeleting} className="bg-danger text-app text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-1.5 disabled:opacity-40">
              <Trash2 size={14} /> {bulkDeleting ? "Eliminando..." : `Eliminar${selected.length ? ` (${selected.length})` : ""}`}
            </button>
          </div>
        </div>
      )}

      <SearchInput value={routineSearch} onChange={setRoutineSearch} placeholder="Buscar rutina por nombre, nivel u objetivo..." className="mb-4 max-w-md" />
      {routineSearch && visible.length === 0 && (
        <p className="text-muted text-sm mb-4">No hay rutinas que coincidan con "{routineSearch}".</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.map((r) => {
          const busy = busyId === r.id;
          const checked = selected.includes(r.id);
          return (
            <div
              key={r.id}
              className={`bg-card rounded-xl p-4 ${selectMode ? "cursor-pointer" : ""} ${checked ? "ring-1 ring-accent" : ""}`}
              onClick={selectMode ? () => toggleSelected(r.id) : undefined}
            >
              <div className="flex items-start gap-3 mb-3">
                {selectMode && (
                  <span className={`w-5 h-5 rounded-md shrink-0 mt-0.5 flex items-center justify-center ${checked ? "bg-accent" : "border border-field-strong"}`}>
                    {checked && <Check size={13} strokeWidth={3} className="text-app" />}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-ink font-medium truncate">{r.title}</h3>
                  <p className="text-muted text-xs mt-0.5">{r.level}{r.goal ? ` · ${r.goal}` : ""}</p>
                </div>
                <span className="flex items-center gap-1 text-muted text-xs shrink-0"><Clock size={12} /> {r.duration_minutes} min</span>
              </div>

              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-muted text-xs">{r.routine_blocks?.length ? `${r.routine_blocks.length} bloques · ` : ""}{r.routine_exercises?.length || 0} ejercicios</span>
                {!selectMode && <button onClick={() => openDetail(r)} className="text-accent text-xs flex items-center gap-0.5 shrink-0">Ver detalle <ChevronRight size={13} /></button>}
              </div>

              {!selectMode && (
                <div className="flex items-center gap-1.5 flex-wrap pt-3 border-t border-white/[0.05]">
                  <button onClick={() => setAssignRoutine(r)} disabled={busy} className={quickBtn}><UserPlus size={13} /> Asignar</button>
                  <button onClick={() => duplicateRoutine(r)} disabled={busy} className={quickBtn}><Copy size={13} /> Duplicar</button>
                  <button onClick={() => pdfFromList(r)} disabled={busy} className={quickBtn}><Download size={13} /> PDF</button>
                  <button onClick={() => deleteFromList(r)} disabled={busy} className={`${quickBtn} hover:text-danger ml-auto`}><Trash2 size={13} /> Eliminar</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {assignRoutine && <AssignRoutineModal routine={assignRoutine} onClose={() => setAssignRoutine(null)} />}
    </div>
  );
}
